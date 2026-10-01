import "server-only";
import { deepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";
import { logAskFailure } from "./log";
import type { AskFilters } from "./schema";

export const DEEPSEEK_MODEL = "deepseek-flash";
// Thinking is on by default and would spend the output budget before any answer text; these
// are short extraction and one-sentence tasks, so it is switched off for speed and cost.
export const DEEPSEEK_NO_THINKING = { deepseek: { thinking: { type: "disabled" as const } } };
const DEFAULT_TIMEOUT_MS = 2_500;

const slotsSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).max(5),
  place: z.string().trim().min(1).max(80).nullable(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)).max(14),
  mode: z.enum(["refine", "new"]),
  // Bounds are applied when merging, so an odd amount loses only the budget, not every slot.
  maxPrice: z.number().nullable().optional(),
});
export type DeepSeekUnderstanding = z.infer<typeof slotsSchema>;
export type TokenUsage = { inputTokens: number; outputTokens: number };
export type GenerateSlots = (input: { system: string; prompt: string; abortSignal: AbortSignal }) => Promise<{ output: DeepSeekUnderstanding; usage: TokenUsage }>;

export const deepseekGenerateSlots: GenerateSlots = async ({ system, prompt, abortSignal }) => {
  const result = await generateText({
    model: deepSeek(DEEPSEEK_MODEL), system, prompt, abortSignal, maxRetries: 0,
    providerOptions: DEEPSEEK_NO_THINKING,
    output: Output.object({ schema: slotsSchema }),
  });
  return { output: result.output, usage: { inputTokens: result.usage.inputTokens ?? 0, outputTokens: result.usage.outputTokens ?? 0 } };
};

function systemPrompt(today: string): string {
  return [
    "You extract search details from what a visitor to KiwiCue, an Auckland events guide, just said.",
    `Today is ${today} in Auckland, New Zealand.`,
    "names: specific artists, shows, films, teams or venues they named, as written. Empty if none.",
    "place: a suburb or venue they want to be near, or null.",
    "dates: exact calendar dates (YYYY-MM-DD) only when they named specific days such as \"Saturday\" or \"3 October\"; otherwise empty.",
    "maxPrice: the most they want to pay per ticket in NZ dollars when they give a budget (\"under 30\", \"30块以内\" → 30), otherwise null.",
    "mode: \"refine\" when the latest message adjusts the earlier request, \"new\" when it starts a different one.",
  ].join("\n");
}

/** Open-ended details Jev cannot enumerate. Returns null when DeepSeek is slow or fails. */
export async function understandWithDeepSeek(input: {
  text: string; history: string[]; previous: AskFilters | null; today: string; generate?: GenerateSlots; timeoutMs?: number;
}): Promise<{ understanding: DeepSeekUnderstanding; usage: TokenUsage } | null> {
  const prompt = JSON.stringify({ latestMessage: input.text, earlierMessages: input.history, currentFilters: input.previous });
  try {
    const result = await (input.generate ?? deepseekGenerateSlots)({
      system: systemPrompt(input.today), prompt, abortSignal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const parsed = slotsSchema.safeParse(result.output);
    return parsed.success ? { understanding: parsed.data, usage: result.usage } : null;
  } catch (error) {
    logAskFailure("deepseek", error);
    return null;
  }
}
