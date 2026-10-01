import { clearChip } from "../../lib/ask/chips";
import { EMPTY_FILTERS, type AskFilters } from "../../lib/ask/schema";
import type { AskViewState } from "./use-ask-stream";

type Language = "en" | "zh";
export type FollowUpOption = { label: string; kind: "refine" | "restart" };
export type FollowUp = { text: string; options: FollowUpOption[] };

const MAX_REFINEMENTS = 3;
const WEEK = 7;
const copy = {
  en: {
    results: "Want me to tweak anything?",
    relaxed: "Nothing matched exactly, so these are the closest. Want to adjust?",
    none: "I couldn't find anything, even after loosening it. Try one of these?",
    anywhere: "Anywhere in Auckland", anyDay: "Any day this week", anyKind: "Any kind of event",
    evening: "In the evening", anyTime: "Any time of day", free: "Only free ones", restart: "Start over",
    askDay: "Which day suits you?", days: ["Tonight", "This weekend", "This week"],
    askArea: "Any part of town you prefer?", areas: ["Central", "North Shore", "East Auckland", "West Auckland"],
  },
  zh: {
    results: "要不要再调整一下？",
    relaxed: "没有完全符合的，这些是最接近的。要调整一下吗？",
    none: "放宽条件后还是没找到，试试这些？",
    anywhere: "奥克兰哪里都行", anyDay: "这周哪天都行", anyKind: "什么类型都行",
    evening: "晚上的", anyTime: "什么时间都行", free: "只要免费的", restart: "重新开始",
    askDay: "哪天方便？", days: ["今晚", "这个周末", "这周内"],
    askArea: "想在哪一片？", areas: ["市中心", "北岸", "东区", "西区"],
  },
} as const;

/** Phrases the understanding step maps cleanly, so tapping one refines the current search. */
function refinements(filters: AskFilters, language: Language): string[] {
  const text = copy[language];
  const candidates: Array<string | null> = [
    filters.area !== "any" ? text.anywhere : null,
    filters.dates.length > 0 && filters.dates.length < WEEK ? text.anyDay : null,
    filters.category !== "any" ? text.anyKind : null,
    filters.timeOfDay === "any" ? text.evening : text.anyTime,
    filters.free ? null : text.free,
  ];
  return candidates.filter((label): label is string => label !== null).slice(0, MAX_REFINEMENTS);
}

function ask(text: string, labels: readonly string[], language: Language): FollowUp {
  const options: FollowUpOption[] = labels.map((label) => ({ label, kind: "refine" }));
  return { text, options: [...options, { label: copy[language].restart, kind: "restart" }] };
}

/**
 * What Kiwi asks once results are showing, so the conversation never stops at them: first the
 * missing day, then the part of town, otherwise tweaks that fit the current filters.
 */
export function followUpFor(search: AskViewState, language: Language): FollowUp {
  const text = copy[language];
  const filters = search.filters ?? EMPTY_FILTERS;
  // Filters the search already loosened are not offered again.
  const tweaks = refinements(search.relaxed.reduce(clearChip, filters), language);
  if (search.cards.length === 0) return ask(text.none, tweaks, language);
  if (search.relaxed.length > 0) return ask(text.relaxed, tweaks, language);
  if (filters.dates.length === 0) return ask(text.askDay, text.days, language);
  if (filters.area === "any" && filters.domain !== "movies") return ask(text.askArea, text.areas, language);
  return ask(text.results, tweaks, language);
}
