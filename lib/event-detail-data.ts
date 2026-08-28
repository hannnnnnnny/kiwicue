import "server-only";
import { cache } from "react";
import { findCuratedMarketDetail, isCuratedMarketId } from "./curated-markets";
import { parseEventId } from "./event-id";
import type { KiwiCueEventDetail } from "./events";
import { fetchAucklandEventDetail, TicketmasterClientError } from "./ticketmaster";
import { fetchAucklandEventFeed } from "./ticketmaster-event-feed";
import type { KiwiCueEvent } from "./events";

type Dependencies = {
  loadTicketmaster: (options: { eventId: string }) => Promise<KiwiCueEventDetail>;
  findCurated: (eventId: string) => KiwiCueEventDetail | null;
};

export class EventPageDataError extends Error {
  constructor(public readonly code: "INVALID_EVENT_ID" | "NOT_FOUND" | "UNAVAILABLE", public readonly status: number) {
    super(code);
    this.name = "EventPageDataError";
  }
}

export async function resolveEventPageData(eventId: unknown, dependencies: Dependencies): Promise<KiwiCueEventDetail> {
  const validId = parseEventId(eventId);
  if (!validId) throw new EventPageDataError("INVALID_EVENT_ID", 404);
  if (isCuratedMarketId(validId)) {
    const event = dependencies.findCurated(validId);
    if (!event) throw new EventPageDataError("NOT_FOUND", 404);
    return event;
  }
  try {
    return await dependencies.loadTicketmaster({ eventId: validId });
  } catch (error) {
    if (error instanceof TicketmasterClientError && error.code === "UPSTREAM_NOT_FOUND") {
      throw new EventPageDataError("NOT_FOUND", 404);
    }
    throw new EventPageDataError("UNAVAILABLE", 503);
  }
}

export const loadEventPageData = cache((eventId: string) => resolveEventPageData(eventId, {
  loadTicketmaster: fetchAucklandEventDetail,
  findCurated: findCuratedMarketDetail,
}));

export const loadRelatedEventCandidates = cache(async (): Promise<KiwiCueEvent[]> => {
  try {
    return (await fetchAucklandEventFeed({ size: 24 })).events;
  } catch {
    return [];
  }
});
