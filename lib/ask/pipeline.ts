import "server-only";
import { aucklandDate } from "../cinemas/auckland-time";
import { loadCandidates, type CandidateSources } from "./candidates";
import { chipsFor } from "./chips";
import { addUsage, costMicroUsd, ZERO_USAGE, type AskUsage } from "./cost";
import type { Evaluate } from "./jev";
import { ASSISTANTS } from "../assistants";
import { logAskFailure } from "./log";
import type { MediaLookup } from "./media";
import { mergeFilters } from "./merge-filters";
import { encodeEvent } from "./ndjson";
import type { QuotaStore } from "./quota";
import { BEST_MIN_SCORE, rankCards } from "./rank";
import { replyDeltas, type StreamReply } from "./reply";
import { askRequestSchema, askStreamEventSchema, type AskCard, type AskErrorCode, type AskFilters, type AskRequest, type AskStreamEvent, type AskTier } from "./schema";
import { understandWithDeepSeek, type GenerateSlots } from "./understand-deepseek";
import { understandWithJev } from "./understand-jev";

export type AskDeps = {
  configured: boolean;
  quota: QuotaStore | null;
  identify(request: Request): Promise<{ subject: string; tier: AskTier; userId: string | null }>;
  evaluate: Evaluate;
  generateSlots: GenerateSlots;
  streamReply: StreamReply;
  sources: CandidateSources;
  media: MediaLookup;
  now(): Date;
};
type Emit = (event: AskStreamEvent) => void;
type Language = "en" | "zh";
type Context = { degrade: boolean; now: Date; deps: AskDeps };

const MAX_BODY_BYTES = 8_192;
const MEDIA_TIMEOUT_MS = 4_000;
const NDJSON = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };
export const ASK_MESSAGES: Record<Language, Record<AskErrorCode | "ai_degraded" | "source_unavailable", string>> = {
  en: {
    rate_limited: "Too many questions at once. Try again in a minute.",
    quota_exhausted: "You've used today's free questions. Sign in for more, or come back tomorrow.",
    budget_exhausted: "KiwiCue's assistant is resting for today. Search still works.",
    invalid: "That question couldn't be read. Try rephrasing it.",
    unavailable: "The assistant isn't available right now.",
    internal: "Something went wrong. Try again.",
    ai_degraded: "Quick mode: results without the spoken summary.",
    source_unavailable: "Some listings couldn't be checked right now.",
  },
  zh: {
    rate_limited: "提问太频繁了，请一分钟后再试。",
    quota_exhausted: "今天的免费提问次数用完了。登录可获得更多次数，或明天再来。",
    budget_exhausted: "KiwiCue 助手今天休息了，普通搜索仍可使用。",
    invalid: "没能读懂这个问题，换个说法试试。",
    unavailable: "助手暂时不可用。",
    internal: "出了点问题，请重试。",
    ai_degraded: "快速模式：只显示结果，没有语音总结。",
    source_unavailable: "部分数据暂时无法获取。",
  },
};

function errorResponse(code: AskErrorCode, status: number, language: Language): Response {
  return new Response(encodeEvent({ type: "error", code, message: ASK_MESSAGES[language][code] }), { status, headers: NDJSON });
}

export function todayLabel(now: Date): string {
  const weekday = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", weekday: "long" }).format(now);
  return `${aucklandDate(now)} (${weekday})`;
}

async function understand(input: AskRequest, ctx: Context): Promise<{ filters: AskFilters; usage: Partial<AskUsage>; degraded: boolean }> {
  if (input.refineOnly && input.previous) return { filters: input.previous, usage: {}, degraded: false };
  const common = { text: input.text, history: input.history, previous: input.previous, today: todayLabel(ctx.now) };
  const [jev, deepseek] = await Promise.all([
    understandWithJev({ ...common, evaluate: ctx.deps.evaluate }).catch((error: unknown) => { logAskFailure("jev", error); return null; }),
    ctx.degrade ? Promise.resolve(null) : understandWithDeepSeek({ ...common, generate: ctx.deps.generateSlots }),
  ]);
  const filters = mergeFilters({ previous: input.previous, jev: jev?.understanding ?? null, deepseek: deepseek?.understanding ?? null, now: ctx.now });
  return {
    filters,
    usage: { jevInputTokens: jev?.inputTokens ?? 0, deepseekInputTokens: deepseek?.usage.inputTokens ?? 0, deepseekOutputTokens: deepseek?.usage.outputTokens ?? 0 },
    degraded: jev === null || (!ctx.degrade && deepseek === null),
  };
}

async function emitReply(input: AskRequest, top: AskCard[], loosened: string[], deps: AskDeps, emit: Emit): Promise<Partial<AskUsage>> {
  const style = ASSISTANTS[input.assistant].style[input.language];
  const reply = replyDeltas({ text: input.text, language: input.language, top, loosened, style, stream: deps.streamReply });
  let step = await reply.next();
  while (!step.done) {
    emit({ type: "reply", delta: step.value });
    step = await reply.next();
  }
  return { deepseekInputTokens: step.value.inputTokens, deepseekOutputTokens: step.value.outputTokens };
}

/** Pictures are a bonus: they stream in when ready and never fail or hold up the answer. */
async function emitMedia(cards: AskCard[], bestId: string | null, language: Language, deps: AskDeps, emit: Emit): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<[]>((resolve) => { timer = setTimeout(() => resolve([]), MEDIA_TIMEOUT_MS); });
  try {
    const found = await Promise.race([deps.media({ cards, bestId, language }), timeout]);
    for (const media of found) {
      const event = askStreamEventSchema.safeParse({ type: "media", ...media });
      if (event.success) emit(event.data);
    }
  } catch (error) {
    logAskFailure("media", error);
  } finally {
    clearTimeout(timer);
  }
}

/** Runs one ask and emits its events in order. Returns the token usage to bill. */
export async function runAsk(input: AskRequest, ctx: Context, emit: Emit): Promise<AskUsage> {
  const understood = await understand(input, ctx);
  let usage = addUsage(ZERO_USAGE, understood.usage);
  const chips = chipsFor(understood.filters, input.language);
  emit({ type: "understood", filters: understood.filters, chips });
  if (ctx.degrade || understood.degraded) emit({ type: "notice", code: "ai_degraded", message: ASK_MESSAGES[input.language].ai_degraded });

  const candidates = await loadCandidates({ filters: understood.filters, language: input.language, now: ctx.now, sources: ctx.deps.sources });
  if (candidates.unavailable.length > 0) emit({ type: "notice", code: "source_unavailable", message: ASK_MESSAGES[input.language].source_unavailable });
  if (candidates.relaxed.length > 0) emit({ type: "relaxed", keys: candidates.relaxed });
  const loosened = candidates.relaxed.flatMap((key) => chips.filter((chip) => chip.key === key).map((chip) => chip.label));
  const ranked = await rankCards({ text: input.text, filters: understood.filters, cards: candidates.cards, evaluate: ctx.deps.evaluate });
  usage = addUsage(usage, { jevInputTokens: ranked.inputTokens });
  ranked.ranked.forEach((card) => emit({ type: "result", card }));
  const best = ranked.ranked[0];
  const bestId = best && best.score >= BEST_MIN_SCORE ? best.id : null;
  if (bestId) emit({ type: "best", id: bestId });

  const media = emitMedia(ranked.ranked, bestId, input.language, ctx.deps, emit);
  const total = ctx.degrade ? usage : addUsage(usage, await emitReply(input, ranked.ranked, loosened, ctx.deps, emit));
  await media;
  return total;
}

async function readRequest(request: Request): Promise<{ ok: true; data: AskRequest } | { ok: false; status: number }> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    const parsed = askRequestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 400 };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, status: 400 };
    throw error;
  }
}

function stream(input: AskRequest, decision: { usageId: string; remaining: number; degrade: boolean; tier: AskTier }, deps: AskDeps): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emit = (event) => controller.enqueue(encodeEvent(event));
      let usage = ZERO_USAGE;
      try {
        usage = await runAsk(input, { degrade: decision.degrade, now: deps.now(), deps }, emit);
        emit({ type: "done", remaining: decision.remaining, tier: decision.tier });
      } catch (error) {
        logAskFailure("stream", error);
        emit({ type: "error", code: "internal", message: ASK_MESSAGES[input.language].internal });
      } finally {
        await deps.quota?.recordCost(decision.usageId, costMicroUsd(usage), decision.degrade);
        controller.close();
      }
    },
  });
  return new Response(body, { headers: NDJSON });
}

export async function handleAsk(request: Request, deps: AskDeps): Promise<Response> {
  const read = await readRequest(request);
  if (!read.ok) return errorResponse("invalid", read.status, "en");
  const { data } = read;
  if (!deps.configured || !deps.quota) return errorResponse("unavailable", 503, data.language);
  const identity = await deps.identify(request);
  const decision = await deps.quota.reserve(identity.subject, identity.tier, identity.userId);
  if (!decision.allowed) return errorResponse(decision.reason, decision.reason === "unavailable" ? 503 : 429, data.language);
  return stream(data, decision, deps);
}
