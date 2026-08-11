import { collectCombinedAucklandVenues } from "../../../lib/venue-catalog";
import {
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../lib/ticketmaster";
import type { AucklandVenue } from "../../../lib/events";

type LoadVenues = () => Promise<AucklandVenue[]>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Venue data is not configured yet.",
  UPSTREAM_NOT_FOUND: "Venue data is temporarily unavailable.",
  UPSTREAM_AUTH: "Venue data is temporarily unavailable.",
  UPSTREAM_BUSY: "Venue data is busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Venue data took too long to respond.",
  UPSTREAM_ERROR: "Venue data is temporarily unavailable.",
};

export async function handleVenuesRequest(
  loadVenues: LoadVenues = collectCombinedAucklandVenues,
): Promise<Response> {
  try {
    const venues = await loadVenues();
    return Response.json(
      { venues },
      { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
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
          message: "Venue data is temporarily unavailable.",
        },
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

export async function GET(): Promise<Response> {
  return handleVenuesRequest();
}
