import type { EventCategory } from "./event-categories";
import type { EventWindow } from "./event-window";
import type { AucklandEventsResult, KiwiCueEvent } from "./events";
import { TicketmasterClientError } from "./ticketmaster";
import { fetchAucklandEventFeed } from "./ticketmaster-event-feed";

const CATALOG_PAGE_SIZE = 50;
const MAX_CATALOG_PAGES = 128;

type LoadEventFeed = (options: {
  size: number;
  window: EventWindow;
  category?: EventCategory;
  venueId?: string;
  cursor?: string;
}) => Promise<AucklandEventsResult>;

export interface EventSuggestionCatalogOptions {
  window: EventWindow;
  category?: EventCategory;
  venueId?: string;
  loadFeed?: LoadEventFeed;
}

function catalogError(): TicketmasterClientError {
  return new TicketmasterClientError("UPSTREAM_ERROR", 502);
}

export async function collectEventSuggestionCatalog({
  window,
  category,
  venueId,
  loadFeed = fetchAucklandEventFeed,
}: EventSuggestionCatalogOptions): Promise<KiwiCueEvent[]> {
  const events = new Map<string, KiwiCueEvent>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_CATALOG_PAGES; page += 1) {
    const result = await loadFeed({
      size: CATALOG_PAGE_SIZE,
      window,
      ...(category ? { category } : {}),
      ...(venueId ? { venueId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    result.events.forEach((event) => events.set(event.id, event));
    cursor = result.nextCursor;
    if (!cursor) return [...events.values()];
    if (seenCursors.has(cursor)) throw catalogError();
    seenCursors.add(cursor);
  }

  throw catalogError();
}
