import type { AucklandEventsResult } from "../../../lib/events";
import {
  fetchAucklandEvents,
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../lib/ticketmaster";

type LoadEvents = (options: { size?: number }) => Promise<AucklandEventsResult>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Event data is not configured yet.",
  UPSTREAM_AUTH: "Event data is temporarily unavailable.",
  UPSTREAM_BUSY: "Event data is busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Event data took too long to respond.",
  UPSTREAM_ERROR: "Event data is temporarily unavailable.",
};

export async function handleEventsRequest(
  request: Request,
  loadEvents: LoadEvents = fetchAucklandEvents,
): Promise<Response> {
  const rawSize = new URL(request.url).searchParams.get("size");
  const parsedSize = rawSize === null || rawSize.trim() === "" ? undefined : Number(rawSize);
  const size = parsedSize !== undefined && Number.isFinite(parsedSize) ? parsedSize : undefined;
  try {
    const payload = await loadEvents({ size });

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
