import type { Language } from "../components/language-provider";
import type { KiwiCuePriceRange } from "./events";

const CURRENCY_PREFIXES: Readonly<Record<string, string>> = {
  AUD: "A$",
  EUR: "€",
  GBP: "£",
  NZD: "NZ$",
  USD: "US$",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000;
}

export function normalizePriceRanges(input: unknown): KiwiCuePriceRange | null {
  if (!Array.isArray(input)) return null;
  for (const item of input) {
    if (!isRecord(item) || (item.type !== undefined && item.type !== "standard")) continue;
    const currency = typeof item.currency === "string" ? item.currency.toUpperCase() : "";
    if (!/^[A-Z]{3}$/.test(currency) || !validAmount(item.min) || !validAmount(item.max)) continue;
    if (item.min > item.max) continue;
    return { currency, minimum: item.min, maximum: item.max };
  }
  return null;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 2 }).format(value);
}

export function formatEventPrice(range: KiwiCuePriceRange | null, language: Language): string {
  if (!range) return language === "zh" ? "价格以官网为准" : "Price on official site";
  const prefix = CURRENCY_PREFIXES[range.currency] ?? `${range.currency} `;
  const minimum = formatAmount(range.minimum);
  if (range.minimum === range.maximum) return `${prefix}${minimum}`;
  return `${prefix}${minimum}–${formatAmount(range.maximum)}`;
}
