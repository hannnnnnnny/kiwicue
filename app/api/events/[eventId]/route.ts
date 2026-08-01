import { parseEventId } from "../../../../lib/event-id";
import type { KiwiCueEventDetail } from "../../../../lib/events";
import {
  fetchAucklandEventDetail,
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../../lib/ticketmaster";

type LoadEventDetail = (options: { eventId: string }) => Promise<KiwiCueEventDetail>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Event data is not configured yet.",
  UPSTREAM_NOT_FOUND: "Event not found.",
  UPSTREAM_AUTH: "Event data is temporarily unavailable.",
  UPSTREAM_BUSY: "Event data is busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Event data took too long to respond.",
  UPSTREAM_ERROR: "Event data is temporarily unavailable.",
};

export async function handleEventDetailRequest(
  eventId: unknown,
  loadDetail: LoadEventDetail = fetchAucklandEventDetail,
): Promise<Response> {
  const validEventId = parseEventId(eventId);
  if (!validEventId) {
    return Response.json(
      { error: { code: "INVALID_EVENT_ID", message: "Invalid event ID." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const event = await loadDetail({ eventId: validEventId });
    return Response.json(
      { event },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (error) {
    if (error instanceof TicketmasterClientError) {
      return Response.json(
        { error: { code: error.code, message: ERROR_MESSAGES[error.code] } },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Event data is temporarily unavailable.",
        },
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const { eventId } = await params;
  return handleEventDetailRequest(eventId);
}
