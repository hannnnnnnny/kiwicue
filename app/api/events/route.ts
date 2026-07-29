import type { AucklandEventsResult } from "../../../lib/events";
import {
  parseEventCategory,
  type EventCategory,
} from "../../../lib/event-categories";
import {
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../lib/ticketmaster";
import { fetchAucklandYearEvents } from "../../../lib/ticketmaster-year-feed";

type LoadEvents = (options: {
  size?: number;
  category?: EventCategory;
  cursor?: string;
}) => Promise<AucklandEventsResult>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Event data is not configured yet.",
  UPSTREAM_AUTH: "Event data is temporarily unavailable.",
  UPSTREAM_BUSY: "Event data is busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Event data took too long to respond.",
  UPSTREAM_ERROR: "Event data is temporarily unavailable.",
};

export async function handleEventsRequest(
  request: Request,
  loadEvents: LoadEvents = fetchAucklandYearEvents,
): Promise<Response> {
  const url = new URL(request.url);
  const rawSize = url.searchParams.get("size");
  const parsedSize = rawSize === null || rawSize.trim() === "" ? undefined : Number(rawSize);
  const size = parsedSize !== undefined && Number.isFinite(parsedSize) ? parsedSize : undefined;
  const categoryValues = url.searchParams.getAll("category");
  const category = parseEventCategory(
    categoryValues.length === 1 ? categoryValues[0] : null,
  );
  const cursorValues = url.searchParams.getAll("cursor");
  const cursorCandidate = cursorValues.length === 1
    ? cursorValues[0].trim()
    : "";
  const cursor = cursorCandidate && cursorCandidate.length <= 4096
    ? cursorCandidate
    : undefined;
  try {
    const payload = await loadEvents({
      size,
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
