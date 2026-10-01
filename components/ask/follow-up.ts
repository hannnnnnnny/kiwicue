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
  },
  zh: {
    results: "要不要再调整一下？",
    relaxed: "没有完全符合的，这些是最接近的。要调整一下吗？",
    none: "放宽条件后还是没找到，试试这些？",
    anywhere: "奥克兰哪里都行", anyDay: "这周哪天都行", anyKind: "什么类型都行",
    evening: "晚上的", anyTime: "什么时间都行", free: "只要免费的", restart: "重新开始",
  },
} as const;

/** Phrases the understanding step maps cleanly, so tapping one refines the current search. */
function refinements(filters: AskFilters, language: Language): string[] {
  const text = copy[language];
  return [
    filters.area !== "any" ? text.anywhere : null,
    filters.dates.length > 0 && filters.dates.length < WEEK ? text.anyDay : null,
    filters.category !== "any" ? text.anyKind : null,
    filters.timeOfDay === "any" ? text.evening : text.anyTime,
    filters.free ? null : text.free,
  ].filter((label): label is string => label !== null).slice(0, MAX_REFINEMENTS);
}

/** What Kiwi asks once a search has finished, so the conversation never stops at the results. */
export function followUpFor(search: AskViewState, language: Language): FollowUp {
  const text = copy[language];
  const question = search.cards.length === 0 ? text.none : search.relaxed.length > 0 ? text.relaxed : text.results;
  const options: FollowUpOption[] = refinements(search.filters ?? EMPTY_FILTERS, language).map((label) => ({ label, kind: "refine" }));
  return { text: question, options: [...options, { label: text.restart, kind: "restart" }] };
}
