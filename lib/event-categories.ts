export const EVENT_CATEGORIES = [
  "concerts",
  "theatre",
  "markets",
  "festivals",
  "sports",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

const categorySet = new Set<string>(EVENT_CATEGORIES);

export const EVENT_CATEGORY_LABELS: Record<EventCategory, { en: string; zh: string }> = {
  concerts: { en: "Concerts", zh: "演唱会" },
  theatre: { en: "Theatre", zh: "话剧演出" },
  markets: { en: "Markets", zh: "市集" },
  festivals: { en: "Festivals", zh: "节日活动" },
  sports: { en: "Sports", zh: "体育赛事" },
};

// Source classifications that map onto a browse category; anything else has no category list.
const CLASSIFICATION_CATEGORY: Record<string, EventCategory> = { Music: "concerts", "Arts & Theatre": "theatre", Sports: "sports" };

/** The browse category an event belongs to, for breadcrumbs and "more like this" links. */
export function categoryOfEvent(event: { category: string | null }, isMarket: boolean): EventCategory | null {
  if (isMarket) return "markets";
  return event.category ? CLASSIFICATION_CATEGORY[event.category] ?? null : null;
}

export function parseEventCategory(
  value: string | string[] | null | undefined,
): EventCategory | null {
  return typeof value === "string" && categorySet.has(value)
    ? value as EventCategory
    : null;
}
