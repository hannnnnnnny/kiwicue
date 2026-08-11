import type { AucklandEventsResult } from "../../../lib/events";
import {
  listCuratedMarkets,
  type CuratedMarketOptions,
} from "../../../lib/curated-markets";
import {
  parseEventCategory,
  type EventCategory,
} from "../../../lib/event-categories";
import { parseEventKeyword, parseVenueId } from "../../../lib/event-search-params";
import {
  parseEventWindow,
  type EventWindow,
} from "../../../lib/event-window";
import {
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../lib/ticketmaster";
import { fetchAucklandEventFeed } from "../../../lib/ticketmaster-event-feed";

type LoadEvents = (options: {
  size?: number;
  category?: EventCategory;
  cursor?: string;
  keyword?: string;
  venueId?: string;
  window?: EventWindow;
}) => Promise<AucklandEventsResult>;

type LoadCuratedEvents = (
  options: CuratedMarketOptions,
) => AucklandEventsResult | Promise<AucklandEventsResult>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Event data is not configured yet.",
  UPSTREAM_NOT_FOUND: "Event not found.",
  UPSTREAM_AUTH: "Event data is temporarily unavailable.",
  UPSTREAM_BUSY: "Event data is busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Event data took too long to respond.",
  UPSTREAM_ERROR: "Event data is temporarily unavailable.",
};

export async function handleEventsRequest(
  request: Request,
  loadEvents: LoadEvents = fetchAucklandEventFeed,
  loadMarkets: LoadCuratedEvents = listCuratedMarkets,
): Promise<Response> {
  const url = new URL(request.url);
  const sizeValues = url.searchParams.getAll("size");
  const rawSize = sizeValues.length === 1 ? sizeValues[0].trim() : "";
  const parsedSize = /^\d+$/.test(rawSize) ? Number(rawSize) : undefined;
  const size = parsedSize !== undefined && Number.isSafeInteger(parsedSize)
    ? Math.min(50, Math.max(1, parsedSize))
    : undefined;
  const categoryValues = url.searchParams.getAll("category");
  const category = parseEventCategory(
    categoryValues.length === 1 ? categoryValues[0] : null,
  );
  const queryValues = url.searchParams.getAll("q");
  const keyword = parseEventKeyword(queryValues.length === 1 ? queryValues[0] : null);
  const venueValues = url.searchParams.getAll("venue");
  const venueId = parseVenueId(venueValues.length === 1 ? venueValues[0] : null);
  const windowValues = url.searchParams.getAll("window");
  const window = parseEventWindow(
    windowValues.length === 1 ? windowValues[0] : null,
  );
  const cursorValues = url.searchParams.getAll("cursor");
  const cursorCandidate = cursorValues.length === 1
    ? cursorValues[0].trim()
    : "";
  const cursor = cursorCandidate && cursorCandidate.length <= 4096
    ? cursorCandidate
    : undefined;
  try {
    const sharedOptions = {
      size,
      ...(keyword ? { keyword } : {}),
      ...(venueId ? { venueId } : {}),
      ...(window !== "all" ? { window } : {}),
    };
    const payload = category === "markets"
      ? await loadMarkets(sharedOptions)
      : await loadEvents({
          ...sharedOptions,
          ...(category ? { category } : {}),
          ...(cursor ? { cursor } : {}),
        });

    return Response.json(payload, {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    if (error instanceof TicketmasterClientError) {
      return Response.json(
        { error: { code: error.code, message: ERROR_MESSAGES[error.code] } },
        {
          status: error.status,
          headers: { "cache-control": "no-store" },
        },
      );
    }
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Event data is temporarily unavailable.",
        },
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleEventsRequest(request);
}
