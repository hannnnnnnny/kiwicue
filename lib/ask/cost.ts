export type AskUsage = { jevInputTokens: number; deepseekInputTokens: number; deepseekOutputTokens: number };
export const ZERO_USAGE: AskUsage = { jevInputTokens: 0, deepseekInputTokens: 0, deepseekOutputTokens: 0 };

// USD per 1M tokens at peak rates; per-token micro-USD is the same number. Checked 2026-10-01
// on docs.typesafe.ai and api-docs.deepseek.com. Using peak rates keeps the budget conservative.
const PRICE = { jevInput: 0.04, deepseekInput: 0.30, deepseekOutput: 1.20 } as const;

export function addUsage(total: AskUsage, extra: Partial<AskUsage>): AskUsage {
  return {
    jevInputTokens: total.jevInputTokens + (extra.jevInputTokens ?? 0),
    deepseekInputTokens: total.deepseekInputTokens + (extra.deepseekInputTokens ?? 0),
    deepseekOutputTokens: total.deepseekOutputTokens + (extra.deepseekOutputTokens ?? 0),
  };
}

export function costMicroUsd(usage: AskUsage): number {
  return Math.ceil(usage.jevInputTokens * PRICE.jevInput
    + usage.deepseekInputTokens * PRICE.deepseekInput
    + usage.deepseekOutputTokens * PRICE.deepseekOutput);
}
