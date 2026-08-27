export const EVENT_CATEGORIES = [
  "concerts",
  "theatre",
  "markets",
  "festivals",
  "sports",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

const categorySet = new Set<string>(EVENT_CATEGORIES);

export function parseEventCategory(
  value: string | string[] | null | undefined,
): EventCategory | null {
  return typeof value === "string" && categorySet.has(value)
    ? value as EventCategory
    : null;
}
