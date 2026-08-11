import { loadEventNameSuggestions } from "../../../../lib/cached-event-suggestions";
import { parseEventCategory, type EventCategory } from "../../../../lib/event-categories";
import { parseEventKeyword, parseVenueId } from "../../../../lib/event-search-params";
import { parseEventWindow, type EventWindow } from "../../../../lib/event-window";
import type { EventNameSuggestion } from "../../../../lib/event-suggestions";
import {
  TicketmasterClientError,
  type TicketmasterErrorCode,
} from "../../../../lib/ticketmaster";

const SUGGESTION_LIMIT = 6;
const SUCCESS_CACHE = "public, s-maxage=60, stale-while-revalidate=300";

type LoadSuggestions = (options: {
  query: string;
  limit: number;
  window: EventWindow;
  category?: EventCategory;
  venueId?: string;
}) => Promise<EventNameSuggestion[]>;

const ERROR_MESSAGES: Record<TicketmasterErrorCode, string> = {
  CONFIG_REQUIRED: "Event suggestions are not configured yet.",
  UPSTREAM_NOT_FOUND: "Event suggestions are temporarily unavailable.",
  UPSTREAM_AUTH: "Event suggestions are temporarily unavailable.",
  UPSTREAM_BUSY: "Event suggestions are busy. Please try again shortly.",
  UPSTREAM_TIMEOUT: "Event suggestions took too long to respond.",
  UPSTREAM_ERROR: "Event suggestions are temporarily unavailable.",
};

function oneValue(url: URL, name: string): string | null {
  const values = url.searchParams.getAll(name);
  return values.length === 1 ? values[0] : null;
}

function errorResponse(error: unknown): Response {
  if (error instanceof TicketmasterClientError) {
    return Response.json(
      { error: { code: error.code, message: ERROR_MESSAGES[error.code] } },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Event suggestions are temporarily unavailable." } },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function handleEventSuggestionsRequest(
  request: Request,
  loadSuggestions: LoadSuggestions = loadEventNameSuggestions,
): Promise<Response> {
  const url = new URL(request.url);
  const query = parseEventKeyword(oneValue(url, "q"));
  if (!query || [...query].length < 2) {
    return Response.json({ suggestions: [] }, { headers: { "cache-control": SUCCESS_CACHE } });
  }

  const category = parseEventCategory(oneValue(url, "category"));
  const venueId = parseVenueId(oneValue(url, "venue"));
  const window = parseEventWindow(oneValue(url, "window"));
  try {
    const suggestions = await loadSuggestions({
      query,
      limit: SUGGESTION_LIMIT,
      window,
      ...(category ? { category } : {}),
      ...(venueId ? { venueId } : {}),
    });
    return Response.json({ suggestions }, { headers: { "cache-control": SUCCESS_CACHE } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleEventSuggestionsRequest(request);
}
