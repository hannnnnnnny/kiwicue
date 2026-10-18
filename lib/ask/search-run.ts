import "server-only";
import { aucklandDate } from "../cinemas/auckland-time";
import { loadCandidates, type CandidateSources } from "./candidates";
import { chipsFor, loosenFilters } from "./chips";
import type { AskUsage } from "./cost";
import type { Evaluate } from "./jev";
import { logAskFailure } from "./log";
import type { MediaLookup } from "./media";
import { mergeFilters, type Slots } from "./merge-filters";
import { BEST_MIN_SCORE, rankCards } from "./rank";
import { askStreamEventSchema, type AskCard, type AskFilters, type AskStreamEvent } from "./schema";
import { understandWithJev } from "./understand-jev";
import { budgetIntent } from "./budget-intent";
import { timeIntent } from "./time-intent";

type Language = "en" | "zh";
export type Emit = (event: AskStreamEvent) => void;
export type SearchDeps = { evaluate: Evaluate; sources: CandidateSources; media: MediaLookup };
export type SearchRequest = {
  text: string; language: Language; previous: AskFilters | null;
  /** Filters to use exactly as given, skipping understanding (a removed chip). */
  exact?: AskFilters; slots?: Slots | null;
  constraints?: string;
};
export type SearchOutcome = {
  filters: AskFilters; top: AskCard[]; loosened: string[]; usage: Partial<AskUsage>;
  understood: boolean; unavailable: boolean; media: Promise<void>;
};

const MEDIA_TIMEOUT_MS = 4_000;

export function todayLabel(now: Date): string {
  const weekday = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", weekday: "long" }).format(now);
  return `${aucklandDate(now)} (${weekday})`;
}

/** Pictures are a bonus: they stream in when ready and never fail or hold up the answer. */
async function emitMedia(cards: AskCard[], bestId: string | null, language: Language, media: MediaLookup, emit: Emit): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<[]>((resolve) => { timer = setTimeout(() => resolve([]), MEDIA_TIMEOUT_MS); });
  try {
    for (const found of await Promise.race([media({ cards, bestId, language }), timeout])) {
      const event = askStreamEventSchema.safeParse({ type: "media", ...found });
      if (event.success) emit(event.data);
    }
  } catch (error) {
    logAskFailure("media", error);
  } finally {
    clearTimeout(timer);
  }
}

async function understand(request: SearchRequest, deps: SearchDeps, now: Date) {
  if (request.exact) return { filters: request.exact, dropped: [], inputTokens: 0, understood: true };
  const jev = await understandWithJev({ text: request.text, history: [], previous: request.previous, today: todayLabel(now), evaluate: deps.evaluate })
    .catch((error: unknown) => { logAskFailure("jev", error); return null; });
  const merged = mergeFilters({ previous: request.previous, jev: jev?.understanding ?? null, slots: request.slots ?? null, now });
  const understood = { ...merged, ...budgetIntent(request.text), ...timeIntent(request.text),
    ...budgetIntent(request.constraints ?? ""), ...timeIntent(request.constraints ?? "") };
  // Loosening goes last, so nothing understood from the wording can put a dropped condition back.
  const { filters, dropped } = loosenFilters(understood, request.slots?.loosen ?? [], request.language);
  return { filters, dropped, inputTokens: jev?.inputTokens ?? 0, understood: jev !== null };
}

/** One search: understand, find, loosen if needed, rank, and stream the cards as they are ready. */
export async function runSearch(request: SearchRequest, deps: SearchDeps, now: Date, emit: Emit): Promise<SearchOutcome> {
  const { filters, dropped, inputTokens, understood } = await understand(request, deps, now);
  const chips = chipsFor(filters, request.language);
  emit({ type: "understood", filters, chips });
  const candidates = await loadCandidates({ filters, language: request.language, now, sources: deps.sources });
  const relaxed = [...dropped.map((chip) => chip.key), ...candidates.relaxed];
  if (relaxed.length > 0) emit({ type: "relaxed", keys: relaxed });
  const ranked = await rankCards({ text: request.text, filters, cards: candidates.cards, evaluate: deps.evaluate });
  ranked.ranked.forEach((card) => emit({ type: "result", card }));
  const best = ranked.ranked[0];
  const bestId = best && best.score >= BEST_MIN_SCORE ? best.id : null;
  if (bestId) emit({ type: "best", id: bestId });
  return {
    filters,
    top: ranked.ranked.slice(0, 6),
    loosened: [...dropped.map((chip) => chip.label), ...candidates.relaxed.flatMap((key) => chips.filter((chip) => chip.key === key).map((chip) => chip.label))],
    usage: { jevInputTokens: inputTokens + ranked.inputTokens },
    understood,
    unavailable: candidates.unavailable.length > 0,
    media: emitMedia(ranked.ranked, bestId, request.language, deps.media, emit),
  };
}
