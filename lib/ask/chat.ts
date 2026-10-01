import "server-only";
import { deepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  MAX_USER_TURNS, QUICK_REPLIES_MAX, QUICK_REPLY_MAX, REPLY_MAX, SEARCH_TEXT_MAX, SUMMARY_MAX,
  type AskChatRequest, type AskChatTurn,
} from "./chat-schema";
import { logAskFailure } from "./log";
import { DEEPSEEK_MODEL, DEEPSEEK_NO_THINKING, type TokenUsage } from "./understand-deepseek";

const DEFAULT_TIMEOUT_MS = 6_000;
const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

// The model may overrun display limits; lengths are enforced after parsing instead.
const modelTurnSchema = z.object({
  reply: z.string().min(1),
  quickReplies: z.array(z.string()),
  ready: z.boolean(),
  summary: z.string().nullable(),
  searchText: z.string().nullable(),
});
export type GenerateTurn = (input: { system: string; prompt: string; abortSignal: AbortSignal }) => Promise<{ output: z.infer<typeof modelTurnSchema>; usage: TokenUsage }>;

export const deepseekGenerateTurn: GenerateTurn = async ({ system, prompt, abortSignal }) => {
  const result = await generateText({
    model: deepSeek(DEEPSEEK_MODEL), system, prompt, abortSignal, maxRetries: 0,
    providerOptions: DEEPSEEK_NO_THINKING, output: Output.object({ schema: modelTurnSchema }),
  });
  return { output: result.output, usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 } };
};

function systemPrompt(language: "en" | "zh", today: string, lastTurn: boolean): string {
  return [
    "You are Kiwi, the friendly voice guide of KiwiCue, an Auckland events, movies and markets guide.",
    `Today is ${today} in Auckland, New Zealand. Your lines are read aloud, so keep them short and natural.`,
    `Always answer in ${language === "zh" ? "Simplified Chinese" : "English"}.`,
    "Find out what the visitor wants before searching: when, who is coming (kids?), what kind of thing, which part of Auckland, and budget.",
    "Ask exactly one question per turn and offer 2-4 short quickReplies that answer it. Do not ask about details they already gave.",
    "When you know enough (at least when and what kind), set ready=true, write a one-line summary such as \"Sat 3 Oct · with kids · East · under $30\",",
    "and a searchText sentence that carries every detail they gave. Otherwise ready=false and summary and searchText are null.",
    "Never name specific events, prices or venues; you have not searched yet.",
    lastTurn ? "This is the last turn: set ready=true now and do not ask another question." : "",
  ].filter(Boolean).join("\n");
}

function clip(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function userText(request: AskChatRequest): string {
  return request.messages.filter(({ role }) => role === "user").map(({ text }) => text).join(" ");
}

/** Used when DeepSeek is skipped or fails: search with everything the visitor has said. */
export function fallbackTurn(request: AskChatRequest): AskChatTurn {
  const said = userText(request);
  return {
    reply: request.language === "zh" ? "好的，我按你说的先帮你找找看。" : "Okay, I'll look with what you've told me so far.",
    quickReplies: [], ready: true, summary: clip(said, SUMMARY_MAX), searchText: clip(said, SEARCH_TEXT_MAX),
  };
}

function normalize(raw: z.infer<typeof modelTurnSchema>, request: AskChatRequest, mustFinish: boolean): AskChatTurn {
  const ready = raw.ready || mustFinish;
  const fallback = fallbackTurn(request);
  return {
    reply: clip(raw.reply, REPLY_MAX) ?? fallback.reply,
    quickReplies: ready ? [] : raw.quickReplies.map((item) => clip(item, QUICK_REPLY_MAX)).filter((item): item is string => item !== null).slice(0, QUICK_REPLIES_MAX),
    ready,
    summary: ready ? clip(raw.summary, SUMMARY_MAX) ?? fallback.summary : null,
    searchText: ready ? clip(raw.searchText, SEARCH_TEXT_MAX) ?? fallback.searchText : null,
  };
}

export async function chatTurn(input: {
  request: AskChatRequest; today: string; generate?: GenerateTurn; forceReady?: boolean; timeoutMs?: number;
}): Promise<{ turn: AskChatTurn; usage: TokenUsage; degraded: boolean }> {
  const { request } = input;
  if (input.forceReady) return { turn: fallbackTurn(request), usage: NO_USAGE, degraded: true };
  const mustFinish = request.messages.filter(({ role }) => role === "user").length >= MAX_USER_TURNS;
  try {
    const result = await (input.generate ?? deepseekGenerateTurn)({
      system: systemPrompt(request.language, input.today, mustFinish),
      prompt: JSON.stringify({ conversation: request.messages }),
      abortSignal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    return { turn: normalize(result.output, request, mustFinish), usage: result.usage, degraded: false };
  } catch (error) {
    logAskFailure("deepseek", error);
    return { turn: fallbackTurn(request), usage: NO_USAGE, degraded: true };
  }
}
