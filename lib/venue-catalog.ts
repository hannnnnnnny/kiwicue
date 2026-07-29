import "server-only";

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
  let cursor: string | null = null;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    if (batch > 0) await wait(200);
    const result = await loadFeed({
      apiKey,
      now,
      size: 50,
      ...(cursor ? { cursor } : {}),
    });
    for (const event of result.events) {
      if (event.venue && !venues.has(event.venue.id)) {
        venues.set(event.venue.id, { id: event.venue.id, name: event.venue.name });
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
