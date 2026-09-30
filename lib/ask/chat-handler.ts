import "server-only";
import { chatTurn, fallbackTurn, type GenerateTurn } from "./chat";
import { askChatRequestSchema, type AskChatRequest, type AskChatTurn } from "./chat-schema";
import { costMicroUsd, ZERO_USAGE } from "./cost";
import { ASK_MESSAGES, todayLabel, type AskDeps } from "./pipeline";
import type { AskErrorCode } from "./schema";

export type AskChatDeps = Pick<AskDeps, "configured" | "quota" | "identify" | "now"> & { generateTurn: GenerateTurn };
type Language = "en" | "zh";

const MAX_BODY_BYTES = 8_192;
const HEADERS = { "cache-control": "no-store" };

function errorJson(code: AskErrorCode, status: number, language: Language): Response {
  return Response.json({ error: { code, message: ASK_MESSAGES[language][code] } }, { status, headers: HEADERS });
}

function turnJson(turn: AskChatTurn, remaining: number): Response {
  return Response.json({ ...turn, remaining }, { headers: HEADERS });
}

async function readThread(request: Request): Promise<{ ok: true; data: AskChatRequest } | { ok: false; status: number }> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { ok: false, status: 413 };
  try {
    const parsed = askChatRequestSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, status: 400 };
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, status: 400 };
    throw error;
  }
}

/** One Kiwi turn. Chat turns never use search quota; running out of them just moves to search. */
export async function handleAskChat(request: Request, deps: AskChatDeps): Promise<Response> {
  const read = await readThread(request);
  if (!read.ok) return errorJson("invalid", read.status, "en");
  const thread = read.data;
  if (!deps.configured || !deps.quota) return errorJson("unavailable", 503, thread.language);
  const identity = await deps.identify(request);
  const decision = await deps.quota.reserve(identity.subject, identity.tier, identity.userId, "chat");
  if (!decision.allowed) {
    if (decision.reason === "quota_exhausted") return turnJson(fallbackTurn(thread), decision.remaining);
    return errorJson(decision.reason, decision.reason === "unavailable" ? 503 : 429, thread.language);
  }
  const result = await chatTurn({ request: thread, today: todayLabel(deps.now()), generate: deps.generateTurn, forceReady: decision.degrade });
  const cost = costMicroUsd({ ...ZERO_USAGE, deepseekInputTokens: result.usage.inputTokens, deepseekOutputTokens: result.usage.outputTokens });
  await deps.quota.recordCost(decision.usageId, cost, decision.degrade || result.degraded);
  return turnJson(result.turn, decision.remaining);
}
