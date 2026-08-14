import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenCinemaClientError,
  buildOpenCinemaUrls,
  fetchAucklandScreenings,
} from "../lib/open-cinema";

const NOW = new Date("2026-08-12T02:00:00.000Z");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Open Cinema client", () => {
  afterEach(() => vi.useRealTimers());

  it("builds bounded Auckland URLs and maps date filters in Auckland time", () => {
    const today = buildOpenCinemaUrls({ query: "  Alien  ", date: "today", now: NOW });
    const tomorrow = buildOpenCinemaUrls({ query: "", date: "tomorrow", now: NOW });
    const weekend = buildOpenCinemaUrls({ query: null, date: "weekend", now: NOW });
    const all = buildOpenCinemaUrls({ query: null, date: "all", now: NOW });

    expect(today).toHaveLength(1);
    expect(today[0].searchParams.get("lat")).toBe("-36.8485");
    expect(today[0].searchParams.get("lon")).toBe("174.7633");
    expect(today[0].searchParams.get("radius_km")).toBe("100");
    expect(today[0].searchParams.get("title")).toBe("Alien");
    expect(today[0].searchParams.get("date")).toBe("2026-08-12");
    expect(tomorrow[0].searchParams.get("date")).toBe("2026-08-13");
    expect(weekend.map((url) => url.searchParams.get("date"))).toEqual(["2026-08-15", "2026-08-16"]);
    expect(all[0].searchParams.has("date")).toBe(false);
  });

  it("normalizes safe screenings and deduplicates ids across weekend requests", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ screenings: [{
      id: "screening-1",
      film_id: "film-1",
      film_title: "Whina",
      film_rating: "M",
      film_runtime_min: 112,
      theater_id: "theater-1",
      theater_name: "Academy Cinemas",
      start_time: "2026-08-15T18:30:00+12:00",
      formats: ["2D", "English subtitles"],
      is_sold_out: false,
      distance_km: 1.4,
      checkout: { type: "deeplink", url: "https://tickets.example/screening-1" },
    }] }));

    const result = await fetchAucklandScreenings({ date: "weekend", now: NOW, query: "Whina", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{
      id: "screening-1",
      filmId: "film-1",
      filmTitle: "Whina",
      filmRating: "M",
      runtimeMinutes: 112,
      cinemaId: "theater-1",
      cinemaName: "Academy Cinemas",
      startTime: "2026-08-15T18:30:00+12:00",
      formats: ["2D", "English subtitles"],
      soldOut: false,
      distanceKilometres: 1.4,
      bookingUrl: "https://tickets.example/screening-1",
    }]);
  });

  it("removes sessions that have already started", async () => {
    const base = {
      film_id: "film-1",
      film_title: "Whina",
      theater_id: "theater-1",
      theater_name: "Academy Cinemas",
      formats: ["2D"],
    };
    const fetchImpl = vi.fn(async () => jsonResponse({ screenings: [
      { ...base, id: "ended", start_time: "2026-08-12T13:30:00+12:00" },
      { ...base, id: "upcoming", start_time: "2026-08-12T15:30:00+12:00" },
    ] }));

    const result = await fetchAucklandScreenings({ date: "today", now: NOW, query: null, fetchImpl });

    expect(result.map(({ id }) => id)).toEqual(["upcoming"]);
  });

  it("rejects malformed or unsafe screening records", async () => {
    const valid = {
      id: "valid",
      film_id: "film-1",
      film_title: "Valid Film",
      theater_id: "theater-1",
      theater_name: "Cinema",
      start_time: "2026-08-12T18:30:00+12:00",
      formats: ["2D"],
      is_sold_out: true,
      checkout: { type: "deeplink", url: "https://tickets.example/valid" },
    };
    const invalid = [
      { ...valid, id: "" },
      { ...valid, id: "missing-title", film_title: "" },
      { ...valid, id: "bad-time", start_time: "soon" },
      { ...valid, id: "unsafe", checkout: { type: "deeplink", url: "javascript:alert(1)" } },
      { ...valid, id: "bad-distance", distance_km: -1 },
      { ...valid, id: "too-long", film_title: "x".repeat(301) },
    ];
    const fetchImpl = vi.fn(async () => jsonResponse({ screenings: [valid, ...invalid] }));

    const result = await fetchAucklandScreenings({ date: "today", now: NOW, query: null, fetchImpl });

    expect(result.map((screening) => screening.id)).toEqual(["valid"]);
  });

  it("adds an optional server credential without leaking it into the URL", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBeDefined();
      expect(init).toBeDefined();
      return jsonResponse({ screenings: [] });
    });
    await fetchAucklandScreenings({ date: "today", now: NOW, query: null, fetchImpl, apiKey: "secret-key" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).not.toContain("secret-key");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-key");
  });

  it("maps busy and general upstream responses to stable errors", async () => {
    await expect(fetchAucklandScreenings({
      date: "today",
      now: NOW,
      query: null,
      fetchImpl: async () => jsonResponse({}, 429),
    })).rejects.toMatchObject({ code: "UPSTREAM_BUSY" });

    await expect(fetchAucklandScreenings({
      date: "today",
      now: NOW,
      query: null,
      fetchImpl: async () => jsonResponse({}, 503),
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });

  it("aborts a request after eight seconds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    const request = fetchAucklandScreenings({ date: "today", now: NOW, query: null, fetchImpl });
    const expectation = expect(request).rejects.toEqual(expect.objectContaining<Partial<OpenCinemaClientError>>({
      code: "UPSTREAM_TIMEOUT",
    }));

    await vi.advanceTimersByTimeAsync(8_001);
    await expectation;
  });
});
