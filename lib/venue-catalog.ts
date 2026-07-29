import "server-only";

import { parseVenueId } from "./event-search-params";
import type { AucklandEventsResult, AucklandVenue } from "./events";
import { TicketmasterClientError } from "./ticketmaster";
import { fetchAucklandEventFeed } from "./ticketmaster-event-feed";

export type VenueFeedLoader = (options: {
  apiKey: string;
  now: Date;
  size: number;
  cursor?: string;
}) => Promise<AucklandEventsResult>;

export async function collectAucklandVenues({
  apiKey = process.env.TICKETMASTER_API_KEY ?? "",
  now = new Date(),
  loadFeed = fetchAucklandEventFeed,
  maxBatches = 128,
  wait = (milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
}: {
  apiKey?: string;
  now?: Date;
  loadFeed?: VenueFeedLoader;
  maxBatches?: number;
  wait?: (milliseconds: number) => Promise<void>;
} = {}): Promise<AucklandVenue[]> {
  const venues = new Map<string, AucklandVenue>();
  const loadedCursors = new Set<string>();
  let cursor: string | null = null;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    if (cursor && loadedCursors.has(cursor)) {
      throw new TicketmasterClientError("UPSTREAM_ERROR", 502);
    }
    if (batch > 0) await wait(200);
    if (cursor) loadedCursors.add(cursor);
    const result = await loadFeed({
      apiKey,
      now,
      size: 50,
      ...(cursor ? { cursor } : {}),
    });
    for (const event of result.events) {
      const venueId = event.venue ? parseVenueId(event.venue.id) : null;
      const venueName = event.venue?.name.trim();
      if (venueId && venueName && !venues.has(venueId)) {
        venues.set(venueId, { id: venueId, name: venueName });
      }
    }
    cursor = result.nextCursor;
    if (!cursor) {
      return [...venues.values()].sort((left, right) =>
        left.name.localeCompare(right.name, "en-NZ", { sensitivity: "base" }),
      );
    }
  }

  throw new TicketmasterClientError("UPSTREAM_ERROR", 502);
}
