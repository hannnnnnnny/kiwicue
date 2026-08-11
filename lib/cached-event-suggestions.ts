import "server-only";

import { unstable_cache } from "next/cache";
import type { EventCategory } from "./event-categories";
import { collectEventSuggestionCatalog } from "./event-suggestion-catalog";
import { suggestEventNamesForVenue, type EventNameSuggestion } from "./event-suggestions";
import type { EventWindow } from "./event-window";

const loadCachedCatalog = unstable_cache(
  async (
    window: EventWindow,
    category: EventCategory | null,
  ) => collectEventSuggestionCatalog({
    window,
    ...(category ? { category } : {}),
  }),
  ["kiwicue-event-suggestion-catalog-v1"],
  { revalidate: 900 },
);

export interface LoadEventSuggestionsOptions {
  query: string;
  limit: number;
  window: EventWindow;
  category?: EventCategory;
  venueId?: string;
}

export async function loadEventNameSuggestions({
  query,
  limit,
  window,
  category,
  venueId,
}: LoadEventSuggestionsOptions): Promise<EventNameSuggestion[]> {
  const events = await loadCachedCatalog(window, category ?? null);
  return suggestEventNamesForVenue(events, query, limit, venueId);
}
