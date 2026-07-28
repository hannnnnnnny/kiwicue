import "server-only";
import type { EventCategory } from "./event-categories";
import type { AucklandEventsResult, KiwiCueEvent } from "./events";

export type { AucklandEventsResult, KiwiCueEvent } from "./events";

export type TicketmasterErrorCode =
  | "CONFIG_REQUIRED"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

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
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
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
  category,
}: {
  apiKey: string;
  now?: Date;
  size?: number;
  category?: EventCategory | null;
}): URL {
  const url = new URL(DISCOVERY_EVENTS_URL);
  const end = new Date(now.getTime() + THIRTY_DAYS_MS);

  url.search = new URLSearchParams({
    apikey: apiKey,
    countryCode: "NZ",
    city: "Auckland",
    locale: "*",
    includeTest: "no",
    sort: "date,asc",
    size: String(clampSize(size)),
    startDateTime: toDiscoveryDateTime(now),
    endDateTime: toDiscoveryDateTime(end),
  }).toString();

  if (category) {
    const [parameter, value] = CATEGORY_FILTERS[category];
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
    venue: venue?.name && venue.city?.name
      ? {
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
  category,
}: {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  size?: number;
  category?: EventCategory | null;
} = {}): Promise<AucklandEventsResult> {
  if (!apiKey.trim()) {
    throw new TicketmasterClientError("CONFIG_REQUIRED", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetchImpl(buildAucklandEventsUrl({ apiKey, now, size, category }), {
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
    const page = payload.page ?? {};

    return {
      events,
      page: {
        size: page.size ?? events.length,
        totalElements: page.totalElements ?? events.length,
        totalPages: page.totalPages ?? (events.length ? 1 : 0),
        number: page.number ?? 0,
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
