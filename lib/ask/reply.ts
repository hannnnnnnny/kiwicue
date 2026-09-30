import "server-only";
import { deepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { logAskFailure } from "./log";
import type { AskCard } from "./schema";
import { DEEPSEEK_MODEL, DEEPSEEK_NO_THINKING, type TokenUsage } from "./understand-deepseek";

const DEFAULT_TIMEOUT_MS = 6_000;
const NO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };
export type StreamReply = (input: { system: string; prompt: string; abortSignal: AbortSignal }) => { textStream: AsyncIterable<string>; usage: PromiseLike<TokenUsage> };

export const deepseekStreamReply: StreamReply = ({ system, prompt, abortSignal }) => {
  const result = streamText({
    model: deepSeek(DEEPSEEK_MODEL), system, prompt, abortSignal, maxRetries: 0, maxOutputTokens: 120,
    providerOptions: DEEPSEEK_NO_THINKING,
  });
  return {
    textStream: result.textStream,
    usage: Promise.resolve(result.usage).then((usage) => ({ inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 })),
  };
};

function system(language: "en" | "zh"): string {
  return language === "zh"
    ? "你是 KiwiCue 的奥克兰活动向导。用一句简短、口语化的中文回答，点名最推荐的那个选项并说明原因。只使用列出的选项，不要编造信息，不要用 Markdown。"
    : "You are KiwiCue's Auckland outing guide. Answer in one short, spoken-style English sentence naming the best option and why. Use only the listed options. No Markdown.";
}

/** Streams the one-sentence reply. Any failure just ends the stream; the cards already answer the question. */
export async function* replyDeltas(input: { text: string; language: "en" | "zh"; top: AskCard[]; stream?: StreamReply; timeoutMs?: number }): AsyncGenerator<string, TokenUsage> {
  if (input.top.length === 0) return NO_USAGE;
  const options = input.top.slice(0, 3).map(({ title, when, venue, priceText, kind }) => ({ kind, title, when, venue, price: priceText }));
  try {
    const result = (input.stream ?? deepseekStreamReply)({
      system: system(input.language), prompt: JSON.stringify({ question: input.text, options }),
      abortSignal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    let wrote = false;
    for await (const delta of result.textStream) {
      wrote ||= delta.length > 0;
      yield delta;
    }
    const usage = await result.usage;
    // An empty reply is not an error to the AI SDK, so record it or it goes unnoticed.
    if (!wrote) logAskFailure("reply", { code: "empty_reply" });
    return usage;
  } catch (error) {
    logAskFailure("reply", error);
    return NO_USAGE;
  }
}
