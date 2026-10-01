export const DEEPSEEK_MODEL = "deepseek-flash";
// Thinking is on by default and would spend the output budget before any answer text; replies
// are short and conversational, so it is switched off for speed and cost.
export const DEEPSEEK_NO_THINKING = { deepseek: { thinking: { type: "disabled" as const } } };
export type TokenUsage = { inputTokens: number; outputTokens: number };
