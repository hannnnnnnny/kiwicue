import "server-only";
import type { EventCategory } from "./event-categories";
import type { KiwiCueEvent, TicketmasterPageResult } from "./events";

export type {
  AucklandEventsResult,
  KiwiCueEvent,
  TicketmasterPageResult,
} from "./events";

export type TicketmasterErrorCode =
  | "CONFIG_REQUIRED"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

export type TicketmasterSort = "date,asc" | "date,desc";

export class TicketmasterClientError extends Error {
  constructor(
    public readonly code: TicketmasterErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = "TicketmasterClientError";
  }
}

interface TicketmasterEventPayload {
  id?: string;
  name?: string;
  url?: string;
  images?: Array<{ url?: string; ratio?: string; width?: number }>;
  dates?: {
    start?: { localDate?: string; localTime?: string; dateTime?: string };
    timezone?: string;
    status?: { code?: string };
  };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{
      id?: string;
      name?: string;
      city?: { name?: string };
      address?: { line1?: string };
    }>;
  };
}

interface TicketmasterResponsePayload {
  _embedded?: { events?: TicketmasterEventPayload[] };
  page?: {
    size?: number;
    totalElements?: number;
    totalPages?: number;
    number?: number;
  };
}

const DISCOVERY_EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json";
const CATEGORY_FILTERS: Record<EventCategory, readonly [string, string]> = {
  concerts: ["classificationName", "Music"],
  theatre: ["classificationName", "Arts & Theatre"],
  markets: ["keyword", "market"],
  festivals: ["keyword", "festival"],
};

function toDiscoveryDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function clampSize(size = 24): number {
  if (!Number.isFinite(size)) return 24;
  return Math.min(50, Math.max(1, Math.trunc(size)));
}

function clampPage(page = 0): number {
  if (!Number.isFinite(page) || !Number.isInteger(page) || page < 0) return 0;
  return page;
}

function errorForStatus(status: number): TicketmasterClientError {
  if (status === 401 || status === 403) {
    return new TicketmasterClientError("UPSTREAM_AUTH", 502);
  }
  if (status === 429) {
    return new TicketmasterClientError("UPSTREAM_BUSY", 503);
  }
  return new TicketmasterClientError("UPSTREAM_ERROR", 502);
}

export function buildAucklandEventsUrl({
  apiKey,
  now = new Date(),
  size = 24,
  page = 0,
  startDateTime,
  endDateTime,
  category,
  keyword,
  venueId,
  sort,
}: {
  apiKey: string;
  now?: Date;
  size?: number;
  page?: number;
  startDateTime?: Date;
  endDateTime?: Date;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  sort?: TicketmasterSort;
}): URL {
  const url = new URL(DISCOVERY_EVENTS_URL);
  const start = new Date((startDateTime ?? now).getTime());
  const end = endDateTime ? new Date(endDateTime.getTime()) : null;

  if (
    !Number.isFinite(start.getTime()) ||
    (end && (!Number.isFinite(end.getTime()) || end <= start))
  ) {
    throw new TicketmasterClientError("UPSTREAM_ERROR", 502);
  }

  url.search = new URLSearchParams({
    apikey: apiKey,
    countryCode: "NZ",
    city: "Auckland",
    locale: "*",
    includeTest: "no",
    includeTBA: "no",
    includeTBD: "no",
    sort: sort ?? "date,asc",
    size: String(clampSize(size)),
    page: String(clampPage(page)),
    startDateTime: toDiscoveryDateTime(start),
  }).toString();

  const normalizedKeyword = keyword?.normalize("NFC").trim().replace(/\s+/gu, " ");
  const categoryFilter = category ? CATEGORY_FILTERS[category] : null;
  const categoryKeyword = categoryFilter?.[0] === "keyword" ? categoryFilter[1] : null;
  const upstreamKeyword = [normalizedKeyword, categoryKeyword].filter(Boolean).join(" ");

  if (end) url.searchParams.set("endDateTime", toDiscoveryDateTime(end));
  if (upstreamKeyword) url.searchParams.set("keyword", upstreamKeyword);
  if (venueId) url.searchParams.set("venueId", venueId);

  if (categoryFilter && categoryFilter[0] !== "keyword") {
    const [parameter, value] = categoryFilter;
    url.searchParams.set(parameter, value);
  }

  return url;
}

export function normalizeTicketmasterEvent(event: TicketmasterEventPayload): KiwiCueEvent | null {
  const localDate = event.dates?.start?.localDate;
  if (!event.id || !event.name || !event.url || !localDate) return null;

  const images = [...(event.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const image = images.find((candidate) => candidate.ratio === "16_9" && candidate.url) ??
    images.find((candidate) => candidate.url);
  const classification = event.classifications?.[0];
  const venue = event._embedded?.venues?.[0];

  return {
    id: event.id,
    name: event.name,
    url: event.url,
    imageUrl: image?.url ?? null,
    start: {
      localDate,
      localTime: event.dates?.start?.localTime ?? null,
      dateTime: event.dates?.start?.dateTime ?? null,
      timezone: event.dates?.timezone ?? "Pacific/Auckland",
    },
    status: event.dates?.status?.code ?? "unknown",
    category: classification?.segment?.name ?? classification?.genre?.name ?? "Other",
    venue: venue?.id && venue.name && venue.city?.name
      ? {
          id: venue.id,
          name: venue.name,
          city: venue.city.name,
          address: venue.address?.line1 ?? null,
        }
      : null,
  };
}

export async function fetchAucklandEvents({
  apiKey = process.env.TICKETMASTER_API_KEY ?? "",
  fetchImpl = fetch,
  now = new Date(),
  size = 24,
  page = 0,
  startDateTime,
  endDateTime,
  category,
  keyword,
  venueId,
  sort,
}: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  size?: number;
  page?: number;
  startDateTime?: Date;
  endDateTime?: Date;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  sort?: TicketmasterSort;
} = {}): Promise<TicketmasterPageResult> {
  if (!apiKey.trim()) {
    throw new TicketmasterClientError("CONFIG_REQUIRED", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetchImpl(buildAucklandEventsUrl({
      apiKey,
      now,
      size,
      page,
      startDateTime,
      endDateTime,
      category,
      keyword,
      venueId,
      sort,
    }), {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw errorForStatus(response.status);
    }

    const payload = await response.json() as TicketmasterResponsePayload;
    const events = (payload._embedded?.events ?? [])
      .map(normalizeTicketmasterEvent)
      .filter((event): event is KiwiCueEvent => event !== null);
    const responsePage = payload.page ?? {};

    return {
      events,
      page: {
        size: responsePage.size ?? events.length,
        totalElements: responsePage.totalElements ?? events.length,
        totalPages: responsePage.totalPages ?? (events.length ? 1 : 0),
        number: responsePage.number ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof TicketmasterClientError) throw error;
    if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new TicketmasterClientError("UPSTREAM_TIMEOUT", 504);
    }
    throw new TicketmasterClientError("UPSTREAM_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}
