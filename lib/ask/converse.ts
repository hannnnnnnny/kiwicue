import "server-only";
import { deepSeek } from "@ai-sdk/deepseek";
import { isStepCount, streamText, type ModelMessage, type ToolSet } from "ai";
import { z } from "zod";
import type { Assistant } from "../assistants";
import { ASK_LAYOUTS, type AskChatTurn, type AskFilters, type AskShown } from "./schema";
import { DEEPSEEK_MODEL, DEEPSEEK_NO_THINKING, type TokenUsage } from "./deepseek";

// Decide (search or not) → search → reply is three steps at most.
const MAX_STEPS = 3;
const MAX_OUTPUT_TOKENS = 600;
const TEMPERATURE = 0.8;

export type ConverseModel = (input: {
  system: string; messages: ModelMessage[]; tools: ToolSet; abortSignal: AbortSignal;
}) => { textStream: AsyncIterable<string>; usage: PromiseLike<TokenUsage> };

export const deepseekConverse: ConverseModel = ({ system, messages, tools, abortSignal }) => {
  const result = streamText({
    model: deepSeek(DEEPSEEK_MODEL), system, messages, tools, abortSignal,
    stopWhen: isStepCount(MAX_STEPS), maxOutputTokens: MAX_OUTPUT_TOKENS, temperature: TEMPERATURE, maxRetries: 0,
    providerOptions: DEEPSEEK_NO_THINKING,
  });
  return {
    textStream: result.textStream,
    usage: Promise.resolve(result.usage).then((usage) => ({ inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 })),
  };
};

export const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(300)
    .describe("What to look for, self-contained with every detail from the chat, e.g. \"live music this Saturday evening in central Auckland under $30 with kids\"."),
  fresh: z.boolean().describe("true when this is a different request; false when it adjusts the current search."),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/u)).max(14)
    .describe("Exact Auckland dates (YYYY-MM-DD) when the visitor named days such as Saturday or 3 October; otherwise empty."),
  names: z.array(z.string().trim().min(1).max(80)).max(5).describe("Specific artists, shows, films, teams or venues named; otherwise empty."),
  place: z.string().trim().min(1).max(80).nullable().describe("A suburb or venue to be near, or null."),
  maxPrice: z.number().nullable().describe("Most they want to pay per ticket in NZD, or null."),
  layout: z.enum(ASK_LAYOUTS)
    .describe("spotlight: one option clearly stands out. timeline: plans for one day or evening, in time order. shelf: many mixed options worth browsing by type. grid: anything else."),
});
export type SearchInput = z.infer<typeof searchInputSchema>;

export const SEARCH_TOOL_DESCRIPTION = "Search KiwiCue's live Auckland listings (events, gigs, theatre, sport, family outings, markets and cinema sessions). The results appear on the visitor's screen as cards.";

export function toModelMessages(history: AskChatTurn[], latest: string): ModelMessage[] {
  return [...history.map(({ role, text }) => ({ role, content: text })), { role: "user", content: latest }];
}

function shownList(shown: AskShown[]): string {
  if (shown.length === 0) return "Nothing on screen yet.";
  return shown.map(({ title, when, venue, price }, index) => `${index + 1}. ${[`${title} — ${when}`, venue, price].filter(Boolean).join(" · ")}`).join("\n");
}

/** The assistant's brief: persona, today, the current search and what the visitor can see. */
export function conversePrompt(input: { assistant: Assistant; today: string; filters: AskFilters | null; shown: AskShown[] }): string {
  const { assistant } = input;
  return [
    `You are ${assistant.name}, the ${assistant.role.en.toLowerCase()} assistant on KiwiCue, a guide to things to do in Auckland, New Zealand. Personality: ${assistant.personality}. ${assistant.style.en}`,
    `Today is ${input.today} in Auckland.`,
    "Talk like a friendly, knowledgeable local in a real chat: natural, specific and varied. Never open two replies the same way, and don't repeat the visitor's words back.",
    "Reply in the language the visitor writes in.",
    "Use the search tool whenever the visitor wants something to do or changes what they want (day, time, area, budget, who is coming, kind of thing). Put every relevant detail from the whole conversation into its query.",
    "Don't search for thanks, small talk, or questions about options already on screen; answer those from the conversation and the list below.",
    "After a search, recommend one to three options by name with concrete reasons such as time, venue or price. If the search loosened some conditions, say so honestly. If nothing fits, say so and suggest a different direction.",
    "Only use facts from search results or the list below; never invent events, times, prices, links or details. If you don't know something, say so and point to the event page.",
    "Keep it short: usually two to five sentences, or a short list for several options. Plain text; **bold** for names is fine; no headings, tables or links.",
    "Ask at most one question, and only when the answer would genuinely change what you find.",
    `Current search: ${input.filters ? JSON.stringify(input.filters) : "No search yet."}`,
    `On screen now:\n${shownList(input.shown)}`,
  ].join("\n");
}
