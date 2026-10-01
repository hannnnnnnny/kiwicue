import type { AskFilters } from "./schema";

const counts: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const number = (value: string) => counts[value.toLowerCase()] ?? Number(value);

export function partySizeFrom(text: string): number | undefined {
  const grouped = [...text.matchAll(/(\d+|one|two|three|four|five|six|[一二两三四五六七八九十])\s*(?:个|位)?\s*(adults?|children|kids?|大人|成人|孩子|小孩|大|小)(?![a-z])/giu)];
  let count = grouped.reduce((sum, match) => sum + number(match[1]), 0);
  if (count > 0 && !grouped.some((match) => /children|kids?|孩子|小孩|小$/iu.test(match[0])) && /\b(?:a|one|1|\d+)\s+\d+[- ]year[- ]old\b|一个\d+岁/u.test(text)) count += 1;
  const total = text.match(/(?:for|party of|group of|all)\s+(\d+|one|two|three|four|five|six)\s*(?:people|persons|of us)\b|(\d+|[一二两三四五六七八九十])\s*(?:个|位)?\s*人/iu);
  const explicit = text.match(/(?:party of|group of)\s+(\d+|one|two|three|four|five|six)\b/iu);
  if (total) count = number(total[1] ?? total[2]);
  else if (explicit) count = number(explicit[1]);
  return Number.isInteger(count) && count >= 1 && count <= 30 ? count : undefined;
}

/** Explicit party totals take precedence over a model's per-ticket interpretation. */
export function budgetIntent(text: string): Partial<AskFilters> {
  const result: Partial<AskFilters> = {};
  const partySize = partySizeFrom(text);
  if (partySize !== undefined) result.partySize = partySize;
  if (/no budget limit|any budget|不限预算|预算不限/iu.test(text)) return { ...result, maxPrice: null, totalBudget: null };
  const amount = text.match(/(?:NZ\s*\$|NZD\s*|\$)\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:纽币|新西兰元|元)/iu);
  if (!amount) return result;
  const value = Number(amount[1] ?? amount[2]);
  if (!Number.isFinite(value) || value < 0 || value > 10000) return result;
  const total = /total|altogether|combined|all[- ]in|for all|总预算|总共|一共|合计|总价/iu.test(text);
  if (total) return { ...result, totalBudget: value, maxPrice: null };
  if (/per (?:person|ticket)|each|a ticket|每(?:人|张)|单张/iu.test(text) && value >= 1 && value <= 1000) {
    return { ...result, maxPrice: Math.round(value), totalBudget: null };
  }
  return result;
}
