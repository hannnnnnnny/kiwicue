import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseEventCategory } from "../lib/event-categories";
import {
  buildAucklandEventsUrl,
  buildTicketmasterEventDetailsUrl,
  fetchAucklandEvents,
  fetchAucklandEventDetail,
  normalizeTicketmasterEvent,
  normalizeTicketmasterEventDetail,
} from "../lib/ticketmaster";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Ticketmaster Discovery client", () => {
  it("has a dedicated server-side client module", () => {
    const modulePath = resolve(projectRoot, "lib/ticketmaster.ts");
    expect(existsSync(modulePath)).toBe(true);
    expect(readFileSync(modulePath, "utf8")).toContain('import "server-only";');
  });

  it("exposes URL building, normalization and fetching boundaries", async () => {
    const client = await import("../lib/ticketmaster");

    expect(client.buildAucklandEventsUrl).toBeTypeOf("function");
    expect(client.normalizeTicketmasterEvent).toBeTypeOf("function");
    expect(client.fetchAucklandEvents).toBeTypeOf("function");
    expect(client.buildTicketmasterEventDetailsUrl).toBeTypeOf("function");
    expect(client.normalizeTicketmasterEventDetail).toBeTypeOf("function");
    expect(client.fetchAucklandEventDetail).toBeTypeOf("function");
    expect(client.TicketmasterClientError).toBeTypeOf("function");
  });

  it("builds a date-sorted Auckland query and clamps the page size", () => {
    const url = buildAucklandEventsUrl({
      apiKey: "test-key",
      now: new Date("2026-07-29T00:00:00.123Z"),
      size: 200,
      page: 3,
    });

    expect(url.origin).toBe("https://app.ticketmaster.com");
    expect(url.pathname).toBe("/discovery/v2/events.json");
    expect(url.searchParams.get("apikey")).toBe("test-key");
    expect(url.searchParams.get("countryCode")).toBe("NZ");
    expect(url.searchParams.get("city")).toBe("Auckland");
    expect(url.searchParams.get("locale")).toBe("*");
    expect(url.searchParams.get("includeTest")).toBe("no");
    expect(url.searchParams.get("sort")).toBe("date,asc");
    expect(url.searchParams.get("size")).toBe("50");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("startDateTime")).toBe("2026-07-29T00:00:00Z");
    expect(url.searchParams.has("endDateTime")).toBe(false);
  });

  it("omits the end date for an unbounded future query", () => {
    const url = buildAucklandEventsUrl({
      apiKey: "test-key",
      now: new Date("2026-07-29T00:00:00.000Z"),
      size: 50,
    });

    expect(url.searchParams.get("startDateTime")).toBe("2026-07-29T00:00:00Z");
    expect(url.searchParams.has("endDateTime")).toBe(false);
    expect(url.searchParams.get("includeTBA")).toBe("no");
    expect(url.searchParams.get("includeTBD")).toBe("no");
  });

  it("combines activity, venue, category, and descending-date filters", () => {
    const url = buildAucklandEventsUrl({
      apiKey: "test-key",
      now: new Date("2026-07-29T00:00:00.000Z"),
      keyword: "Taylor Swift",
      venueId: "KovZpZA6t7kA",
      category: "concerts",
      sort: "date,desc",
    });

    expect(url.searchParams.get("keyword")).toBe("Taylor Swift");
    expect(url.searchParams.get("venueId")).toBe("KovZpZA6t7kA");
    expect(url.searchParams.get("classificationName")).toBe("Music");
    expect(url.searchParams.get("sort")).toBe("date,desc");
  });

  it("combines a user keyword with a keyword-backed category", () => {
    const url = buildAucklandEventsUrl({
      apiKey: "test-key",
      now: new Date("2026-07-29T00:00:00.000Z"),
      keyword: "Taylor Swift",
      category: "markets",
    });

    expect(url.searchParams.get("keyword")).toBe("Taylor Swift market");
    expect(url.searchParams.getAll("keyword")).toEqual(["Taylor Swift market"]);
  });

  it("uses explicit range bounds for subdivided year queries", () => {
    const url = buildAucklandEventsUrl({
      apiKey: "test-key",
      now: new Date("2026-07-29T00:00:00Z"),
      startDateTime: new Date("2026-09-01T00:00:00.321Z"),
      endDateTime: new Date("2026-10-01T00:00:00.999Z"),
      page: 2,
    });

    expect(url.searchParams.get("startDateTime")).toBe("2026-09-01T00:00:00Z");
    expect(url.searchParams.get("endDateTime")).toBe("2026-10-01T00:00:00Z");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "falls back to page zero for unsafe page value %s",
    (page) => {
      const url = buildAucklandEventsUrl({
        apiKey: "test-key",
        now: new Date("2026-07-29T00:00:00Z"),
        page,
      });

      expect(url.searchParams.get("page")).toBe("0");
    },
  );

  it("accepts only the five public category keys", () => {
    expect(parseEventCategory("concerts")).toBe("concerts");
    expect(parseEventCategory("theatre")).toBe("theatre");
    expect(parseEventCategory("markets")).toBe("markets");
    expect(parseEventCategory("festivals")).toBe("festivals");
    expect(parseEventCategory("sports")).toBe("sports");
    expect(parseEventCategory("Music")).toBeNull();
    expect(parseEventCategory(["concerts", "theatre"])).toBeNull();
    expect(parseEventCategory(undefined)).toBeNull();
  });

  it.each([
    ["concerts", "classificationName", "Music"],
    ["theatre", "classificationName", "Arts & Theatre"],
    ["markets", "keyword", "market"],
    ["festivals", "keyword", "festival"],
    ["sports", "classificationName", "Sports"],
  ] as const)("maps %s to the Ticketmaster %s filter", (category, parameter, expected) => {
    const url = buildAucklandEventsUrl({
      apiKey: "server-key",
      now: new Date("2026-07-29T00:00:00Z"),
      category,
    });

    expect(url.searchParams.get(parameter)).toBe(expected);
    expect(url.searchParams.get("city")).toBe("Auckland");
    expect(url.searchParams.get("countryCode")).toBe("NZ");
    expect(url.searchParams.get("sort")).toBe("date,asc");
  });

  it("normalizes only the event fields KiwiCue needs", () => {
    const event = normalizeTicketmasterEvent({
      id: "event-123",
      name: "Auckland Night Live",
      url: "https://www.ticketmaster.co.nz/event/event-123",
      images: [
        { url: "https://img.example/square.jpg", ratio: "3_2", width: 1024 },
        { url: "https://img.example/wide.jpg", ratio: "16_9", width: 640 },
      ],
      dates: {
        start: {
          localDate: "2026-08-01",
          localTime: "19:30:00",
          dateTime: "2026-08-01T07:30:00Z",
        },
        timezone: "Pacific/Auckland",
        status: { code: "onsale" },
      },
      classifications: [{ segment: { name: "Music" } }],
      _embedded: {
        venues: [
          {
            id: "venue-civic",
            name: "The Civic",
            city: { name: "Auckland" },
            address: { line1: "269 Queen Street", line2: "Auckland Central" },
            postalCode: "1010",
            location: { latitude: "-36.8505", longitude: "174.7645" },
          },
        ],
      },
    });

    expect(event).toEqual({
      id: "event-123",
      name: "Auckland Night Live",
      url: "https://www.ticketmaster.co.nz/event/event-123",
      imageUrl: "https://img.example/wide.jpg",
      start: {
        localDate: "2026-08-01",
        localTime: "19:30:00",
        dateTime: "2026-08-01T07:30:00Z",
        timezone: "Pacific/Auckland",
      },
      status: "onsale",
      category: "Music",
      venue: {
        id: "venue-civic",
        name: "The Civic",
        city: "Auckland",
        address: "269 Queen Street, Auckland Central",
        postalCode: "1010",
        coordinates: { latitude: -36.8505, longitude: 174.7645 },
      },
    });
  });

  it("collects bounded, deduplicated genre labels across all classifications", () => {
    const normalized = normalizeTicketmasterEvent({
      id: "event-tags",
      name: "Auckland genre night",
      url: "https://ticketmaster.co.nz/event-tags",
      dates: { start: { localDate: "2026-08-01" } },
      classifications: [
        {
          segment: { name: "Music" },
          genre: { name: "Rock" },
          subGenre: { name: "Alternative" },
          type: { name: "Concert" },
          subType: { name: "Undefined" },
        },
        {
          genre: { name: " rock " },
          subGenre: { name: "Jazz" },
          type: { name: "Festival" },
        },
      ],
    });

    expect(normalized?.tags).toEqual(["Rock", "Alternative", "Concert", "Jazz", "Festival"]);
  });

  it("omits classification labels when upstream only provides placeholders", () => {
    const normalized = normalizeTicketmasterEvent({
      id: "event-no-tags",
      name: "Auckland event",
      url: "https://ticketmaster.co.nz/event-no-tags",
      dates: { start: { localDate: "2026-08-01" } },
      classifications: [{ genre: { name: "Undefined" }, subGenre: { name: "N/A" } }],
    });

    expect(normalized).not.toHaveProperty("tags");
  });

  it("keeps the Ticketmaster venue ID during normalization", () => {
    const normalized = normalizeTicketmasterEvent({
      id: "event-1",
      name: "Auckland Live",
      url: "https://ticketmaster.co.nz/event-1",
      dates: { start: { localDate: "2026-08-01" } },
      _embedded: { venues: [{ id: "venue-1", name: "The Civic", city: { name: "Auckland" } }] },
    });

    expect(normalized?.venue).toEqual({
      id: "venue-1",
      name: "The Civic",
      city: "Auckland",
      address: null,
      postalCode: null,
      coordinates: null,
    });
  });

  it("normalizes verified NZD admission and a bounded organiser", () => {
    const normalized = normalizeTicketmasterEvent({
      id: "event-free",
      name: "Free Auckland event",
      url: "https://ticketmaster.co.nz/event-free",
      dates: { start: { localDate: "2026-08-01" } },
      priceRanges: [{ currency: "NZD", min: 0, max: 0 }],
      promoter: { name: "  Auckland   Arts  " },
    });
    expect(normalized).toMatchObject({
      admission: { kind: "free", currency: "NZD" },
      organiserName: "Auckland Arts",
    });
  });

  it.each([
    [[{ currency: "USD", min: 0, max: 0 }]],
    [[{ currency: "NZD", min: -1, max: 20 }]],
    [[{ currency: "NZD", min: 30, max: 20 }]],
    [[{ currency: "NZD", min: Number.NaN, max: 20 }]],
  ])("omits invalid admission evidence", (priceRanges) => {
    const normalized = normalizeTicketmasterEvent({
      id: "event-price",
      name: "Auckland event",
      url: "https://ticketmaster.co.nz/event-price",
      dates: { start: { localDate: "2026-08-01" } },
      priceRanges,
    });
    expect(normalized?.admission).toBeUndefined();
  });

  it("rejects an unsafe upstream event ID before it can become a route", () => {
    const normalized = normalizeTicketmasterEvent({
      id: "../private",
      name: "Unsafe event",
      url: "https://www.ticketmaster.co.nz/event/unsafe",
      dates: { start: { localDate: "2026-08-01" } },
    });

    expect(normalized).toBeNull();
  });

  it("builds a validated event-details URL without changing the event ID", () => {
    const url = buildTicketmasterEventDetailsUrl({
      apiKey: "server-key",
      eventId: "G5diZfkn0B-bh",
    });

    expect(url.origin).toBe("https://app.ticketmaster.com");
    expect(url.pathname).toBe("/discovery/v2/events/G5diZfkn0B-bh.json");
    expect(url.searchParams.get("apikey")).toBe("server-key");
    expect(url.searchParams.get("locale")).toBe("*");
  });

  it("normalizes verified details, complete venue data, and an HTTPS official URL", () => {
    const normalized = normalizeTicketmasterEventDetail({
      id: "event-123",
      name: "Auckland Night Live",
      url: "https://www.ticketmaster.co.nz/event/event-123",
      info: "  Doors open at 6:30 pm.  ",
      pleaseNote: " Age restrictions may apply. ",
      dates: { start: { localDate: "2026-08-08" } },
      _embedded: {
        venues: [{
          id: "venue-civic",
          name: "The Civic",
          city: { name: "Auckland" },
          address: { line1: "269 Queen Street" },
          postalCode: "1010",
          location: { latitude: "-36.8505", longitude: "174.7645" },
        }],
      },
    });

    expect(normalized).toMatchObject({
      id: "event-123",
      description: "Doors open at 6:30 pm.",
      note: "Age restrictions may apply.",
      venue: {
        postalCode: "1010",
        coordinates: { latitude: -36.8505, longitude: 174.7645 },
      },
    });
  });

  it.each([
    ["http://www.ticketmaster.co.nz/event/event-123", "insecure URL"],
    ["javascript:alert(1)", "script URL"],
    ["https://www.ticketmaster.co.nz/event/event-123", "invalid coordinates"],
  ])("rejects unsafe detail data: %s (%s)", (url) => {
    const payload = {
      id: "event-123",
      name: "Auckland Night Live",
      url,
      dates: { start: { localDate: "2026-08-08" } },
      _embedded: {
        venues: [{
          id: "venue-civic",
          name: "The Civic",
          city: { name: "Auckland" },
          location: { latitude: "95", longitude: "174.7645" },
        }],
      },
    };

    const normalized = normalizeTicketmasterEventDetail(payload);
    if (url.startsWith("https:")) {
      expect(normalized?.venue?.coordinates).toBeNull();
    } else {
      expect(normalized).toBeNull();
    }
  });

  it("fetches one normalized event detail", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: "event-456",
      name: "Harbour Lights",
      url: "https://www.ticketmaster.co.nz/event/event-456",
      info: "Official information",
      dates: { start: { localDate: "2026-08-03" } },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await fetchAucklandEventDetail({
      apiKey: "test-key",
      eventId: "event-456",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [request, init] = fetchImpl.mock.calls[0];
    expect(String(request)).not.toContain("undefined");
    expect(new URL(String(request)).pathname).toContain("/events/event-456.json");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({ id: "event-456", description: "Official information" });
  });

  it("maps an upstream missing event to a safe public 404", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("private missing-event body", { status: 404 }),
    );

    const request = fetchAucklandEventDetail({
      apiKey: "test-key",
      eventId: "event-404",
      fetchImpl,
    });

    await expect(request).rejects.toMatchObject({ code: "UPSTREAM_NOT_FOUND", status: 404 });
    await expect(request).rejects.not.toThrow("private missing-event body");
  });

  it("fails safely before making a request when the API key is missing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(fetchAucklandEvents({ apiKey: "", fetchImpl })).rejects.toMatchObject({
      code: "CONFIG_REQUIRED",
      status: 503,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a reversed explicit range before making a request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(fetchAucklandEvents({
      apiKey: "test-key",
      fetchImpl,
      startDateTime: new Date("2026-10-01T00:00:00Z"),
      endDateTime: new Date("2026-09-01T00:00:00Z"),
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches and returns a normalized event collection", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          _embedded: {
            events: [
              {
                id: "event-456",
                name: "Harbour Lights",
                url: "https://www.ticketmaster.co.nz/event/event-456",
                dates: {
                  start: { localDate: "2026-08-03" },
                  timezone: "Pacific/Auckland",
                  status: { code: "onsale" },
                },
              },
            ],
          },
          page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await fetchAucklandEvents({
      apiKey: "test-key",
      fetchImpl,
      now: new Date("2026-07-29T00:00:00.000Z"),
      size: 1,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [request, init] = fetchImpl.mock.calls[0];
    expect(new URL(String(request)).searchParams.get("apikey")).toBe("test-key");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({
      events: [
        {
          id: "event-456",
          name: "Harbour Lights",
          url: "https://www.ticketmaster.co.nz/event/event-456",
          imageUrl: null,
          start: {
            localDate: "2026-08-03",
            localTime: null,
            dateTime: null,
            timezone: "Pacific/Auckland",
          },
          status: "onsale",
          category: "Other",
          venue: null,
        },
      ],
      page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
    });
  });

  it.each([
    [401, "UPSTREAM_AUTH", 502],
    [403, "UPSTREAM_AUTH", 502],
    [429, "UPSTREAM_BUSY", 503],
    [500, "UPSTREAM_ERROR", 502],
  ] as const)("maps Ticketmaster status %i to a safe %s error", async (upstreamStatus, code, status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("upstream details must stay private", { status: upstreamStatus }),
    );

    const request = fetchAucklandEvents({ apiKey: "test-key", fetchImpl });

    await expect(request).rejects.toMatchObject({ code, status });
    await expect(request).rejects.not.toThrow("upstream details must stay private");
  });

  it("aborts a slow upstream request after eight seconds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_request, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The request was aborted", "AbortError"));
        });
      }),
    );

    try {
      const request = fetchAucklandEvents({ apiKey: "test-key", fetchImpl });
      const handledResult = request.catch((error: unknown) => error);

      await vi.advanceTimersByTimeAsync(7_999);
      expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(handledResult).resolves.toMatchObject({
        code: "UPSTREAM_TIMEOUT",
        status: 504,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides network and response parsing failures behind a safe error", async () => {
    const privateFailure = new Error("private DNS and request details");
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(privateFailure);

    const request = fetchAucklandEvents({ apiKey: "test-key", fetchImpl });

    await expect(request).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    await expect(request).rejects.not.toBe(privateFailure);
  });
});
