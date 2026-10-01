import "server-only";
import { tool } from "ai";
import { ASSISTANTS } from "../assistants";
import type { CandidateSources } from "./candidates";
import { conversePrompt, SEARCH_TOOL_DESCRIPTION, searchInputSchema, toModelMessages, type ConverseModel, type SearchInput } from "./converse";
import { addUsage, costMicroUsd, ZERO_USAGE, type AskUsage } from "./cost";
import type { Evaluate } from "./jev";
import { logAskFailure } from "./log";
import type { MediaLookup } from "./media";
import { encodeEvent } from "./ndjson";
import type { QuotaStore } from "./quota";
import { sanitizeDates } from "./resolve-dates";
import { askRequestSchema, type AskCard, type AskErrorCode, type AskRequest, type AskTier } from "./schema";
import { runSearch, todayLabel, type Emit, type SearchOutcome, type SearchRequest } from "./search-run";

export { todayLabel };
export type AskDeps = {
  configured: boolean;
  quota: QuotaStore | null;
  identify(request: Request): Promise<{ subject: string; tier: AskTier; userId: string | null }>;
  evaluate: Evaluate;
  converse: ConverseModel;
  sources: CandidateSources;
  media: MediaLookup;
  now(): Date;
};
type Language = "en" | "zh";
type Context = { degrade: boolean; now: Date; deps: AskDeps };

const MAX_BODY_BYTES = 32_768;
const MAX_SEARCHES_PER_MESSAGE = 2;
const CONVERSE_TIMEOUT_MS = 22_000;
const NDJSON = { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" };
export const ASK_MESSAGES: Record<Language, Record<AskErrorCode | "ai_degraded" | "source_unavailable", string>> = {
  en: {
    rate_limited: "Too many questions at once. Try again in a minute.",
    quota_exhausted: "You've used today's free questions. Sign in for more, or come back tomorrow.",
    budget_exhausted: "KiwiCue's assistant is resting for today. Search still works.",
    invalid: "That question couldn't be read. Try rephrasing it.",
    unavailable: "The assistant isn't available right now.",
    internal: "Something went wrong. Try again.",
    ai_degraded: "Quick mode: here are the results without a chat reply.",
    source_unavailable: "Some listings couldn't be checked right now.",
  },
  zh: {
    rate_limited: "提问太频繁了，请一分钟后再试。",
    quota_exhausted: "今天的免费提问次数用完了。登录可获得更多次数，或明天再来。",
    budget_exhausted: "KiwiCue 助手今天休息了，普通搜索仍可使用。",
    invalid: "没能读懂这个问题，换个说法试试。",
    unavailable: "助手暂时不可用。",
    internal: "出了点问题，请重试。",
    ai_degraded: "快速模式：先给你结果，暂时没有对话回复。",
    source_unavailable: "部分数据暂时无法获取。",
  },
};

function errorResponse(code: AskErrorCode, status: number, language: Language): Response {
  return new Response(encodeEvent({ type: "error", code, message: ASK_MESSAGES[language][code] }), { status, headers: NDJSON });
}

function localWhen(card: AskCard): string {
  const date = new Date(card.when);
  if (!Number.isFinite(date.getTime())) return card.when;
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/** What the model sees of a search: enough to recommend, nothing it could mistake for instructions. */
function toolResult(outcome: SearchOutcome) {
  return {
    found: outcome.top.length,
    loosened: outcome.loosened,
    options: outcome.top.map((card, index) => ({
      n: index + 1, kind: card.kind, title: card.title, when: localWhen(card), venue: card.venue, price: card.priceText,
      sessions: card.sessionCount,
      bookingUrl: card.bookingUrl ?? null, href: card.href,
      budgetStatus: card.budgetStatus ?? "unknown", minPartyCost: card.minPartyCost ?? null,
      durationMinutes: card.durationMinutes ?? null, indoor: card.indoor ?? false,
    })),
  };
}

/** Runs searches for one message and remembers the latest filters, so a second search refines the first. */
function searcher(input: AskRequest, ctx: Context, emit: Emit) {
  let current = input.previous;
  let usage = ZERO_USAGE;
  const media: Promise<void>[] = [];
  let unavailable = false;
  let count = 0;
  const run = async (request: SearchRequest) => {
    count += 1;
    const outcome = await runSearch(request, ctx.deps, ctx.now, emit);
    current = outcome.filters;
    usage = addUsage(usage, outcome.usage);
    media.push(outcome.media);
    if (outcome.unavailable && !unavailable) {
      unavailable = true;
      emit({ type: "notice", code: "source_unavailable", message: ASK_MESSAGES[input.language].source_unavailable });
    }
    return outcome;
  };
  const fromTool = async (args: SearchInput) => {
    if (count >= MAX_SEARCHES_PER_MESSAGE) return { error: "Already searched enough for this message; reply with what you found." };
    const outcome = await run({
      text: args.query, language: input.language, previous: args.fresh ? null : current,
      constraints: input.text,
      slots: { names: args.names, place: args.place, dates: sanitizeDates(args.dates, ctx.now), mode: args.fresh ? "new" : "refine", maxPrice: args.maxPrice,
        totalBudget: args.totalBudget, partySize: args.partySize, startMinute: args.startMinute, endMinute: args.endMinute },
    });
    emit({ type: "layout", layout: args.layout });
    return toolResult(outcome);
  };
  return {
    run, fromTool,
    get searched() { return count > 0; },
    async finish() { await Promise.all(media); return usage; },
  };
}

/** The assistant replies in its own words, searching when it decides to. Falls back to a plain search. */
async function converse(input: AskRequest, ctx: Context, emit: Emit, search: ReturnType<typeof searcher>): Promise<Partial<AskUsage>> {
  const tools = { search: tool({ description: SEARCH_TOOL_DESCRIPTION, inputSchema: searchInputSchema, execute: search.fromTool }) };
  const system = conversePrompt({ assistant: ASSISTANTS[input.assistant], today: todayLabel(ctx.now), filters: input.previous, shown: input.shown });
  let wrote = false;
  try {
    const turn = ctx.deps.converse({ system, messages: toModelMessages(input.history, input.text), tools, abortSignal: AbortSignal.timeout(CONVERSE_TIMEOUT_MS) });
    for await (const delta of turn.textStream) {
      wrote ||= delta.length > 0;
      emit({ type: "reply", delta });
    }
    const usage = await turn.usage;
    if (!wrote) logAskFailure("reply", { code: "empty_reply" });
    return { deepseekInputTokens: usage.inputTokens, deepseekOutputTokens: usage.outputTokens };
  } catch (error) {
    logAskFailure("reply", error);
    if (!wrote && !search.searched) {
      emit({ type: "notice", code: "ai_degraded", message: ASK_MESSAGES[input.language].ai_degraded });
      await search.run({ text: input.text, language: input.language, previous: input.previous });
    }
    return {};
  }
}

/** Runs one message and emits its events in order. Returns the token usage to bill. */
export async function runAsk(input: AskRequest, ctx: Context, emit: Emit): Promise<AskUsage> {
  const search = searcher(input, ctx, emit);
  if (input.refineOnly && input.previous) {
    await search.run({ text: input.text, language: input.language, previous: input.previous, exact: input.previous });
    return search.finish();
  }
  if (ctx.degrade) {
    emit({ type: "notice", code: "ai_degraded", message: ASK_MESSAGES[input.language].ai_degraded });
    await search.run({ text: input.text, language: input.language, previous: input.previous });
    return search.finish();
  }
  const replyUsage = await converse(input, ctx, emit, search);
  return addUsage(await search.finish(), replyUsage);
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
