import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseEventCategory } from "../lib/event-categories";
import {
  buildAucklandEventsUrl,
  fetchAucklandEvents,
  normalizeTicketmasterEvent,
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
    expect(url.searchParams.get("endDateTime")).toBe("2027-07-29T00:00:00Z");
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

  it("accepts only the four public category keys", () => {
    expect(parseEventCategory("concerts")).toBe("concerts");
    expect(parseEventCategory("theatre")).toBe("theatre");
    expect(parseEventCategory("markets")).toBe("markets");
    expect(parseEventCategory("festivals")).toBe("festivals");
    expect(parseEventCategory("Music")).toBeNull();
    expect(parseEventCategory(["concerts", "theatre"])).toBeNull();
    expect(parseEventCategory(undefined)).toBeNull();
  });

  it.each([
    ["concerts", "classificationName", "Music"],
    ["theatre", "classificationName", "Arts & Theatre"],
    ["markets", "keyword", "market"],
    ["festivals", "keyword", "festival"],
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
            name: "The Civic",
            city: { name: "Auckland" },
            address: { line1: "269 Queen Street" },
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
        name: "The Civic",
        city: "Auckland",
        address: "269 Queen Street",
      },
    });
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
