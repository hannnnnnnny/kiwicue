import "server-only";

import { unstable_cache } from "next/cache";
import {
  listCuratedMarkets,
  type CuratedMarketOptions,
} from "./curated-markets";
import type { EventCategory } from "./event-categories";
import { collectEventSuggestionCatalog } from "./event-suggestion-catalog";
import { suggestEventNamesForVenue, type EventNameSuggestion } from "./event-suggestions";
import type { AucklandEventsResult, KiwiCueEvent } from "./events";
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

interface EventSuggestionDependencies {
  loadCatalog: (
    window: EventWindow,
    category: EventCategory | null,
  ) => Promise<KiwiCueEvent[]>;
  loadMarkets: (
    options: CuratedMarketOptions,
  ) => AucklandEventsResult | Promise<AucklandEventsResult>;
}

const defaultDependencies: EventSuggestionDependencies = {
  loadCatalog: loadCachedCatalog,
  loadMarkets: listCuratedMarkets,
};

export async function loadEventNameSuggestions({
  query,
  limit,
  window,
  category,
  venueId,
}: LoadEventSuggestionsOptions,
dependencies: EventSuggestionDependencies = defaultDependencies,
): Promise<EventNameSuggestion[]> {
  const events = category === "markets"
    ? (await dependencies.loadMarkets({
        keyword: query,
        size: limit,
        window,
        ...(venueId ? { venueId } : {}),
      })).events
    : await dependencies.loadCatalog(window, category ?? null);

  return suggestEventNamesForVenue(events, query, limit, venueId);
}
