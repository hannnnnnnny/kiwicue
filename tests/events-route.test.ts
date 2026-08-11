import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleEventsRequest } from "../app/api/events/route";
import { TicketmasterClientError } from "../lib/ticketmaster";

const projectRoot = resolve(import.meta.dirname, "..");
const emptyResult = {
  events: [],
  page: { size: 50, totalElements: 0, totalPages: 0, number: 0 },
  nextCursor: null,
};

describe("GET /api/events", () => {
  it("is implemented as an App Router route", () => {
    expect(existsSync(resolve(projectRoot, "app/api/events/route.ts"))).toBe(true);
  });

  it("exposes the framework GET handler and a testable request boundary", async () => {
    const route = await import("../app/api/events/route");

    expect(route.GET).toBeTypeOf("function");
    expect(route.handleEventsRequest).toBeTypeOf("function");
  });

  it("returns normalized Auckland events without server credentials", async () => {
    const payload = {
      events: [
        {
          id: "event-1",
          name: "Auckland Live",
          url: "https://www.ticketmaster.co.nz/event/event-1",
          imageUrl: null,
          start: {
            localDate: "2026-08-01",
            localTime: null,
            dateTime: null,
            timezone: "Pacific/Auckland",
          },
          status: "onsale",
          category: "Music",
          priceRange: null,
          venue: null,
        },
      ],
      page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
      nextCursor: "next-safe-cursor",
    };
    const loadEvents = vi.fn().mockResolvedValue(payload);

    const response = await handleEventsRequest(
      new Request("http://localhost/api/events?size=12"),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: 12 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    const body = await response.json();
    expect(body).toEqual(payload);
    expect(JSON.stringify(body)).not.toContain("TICKETMASTER_API_KEY");
  });

  it("passes one validated category to the server client", async () => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request("http://localhost/api/events?size=24&category=concerts"),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: 24, category: "concerts" });
  });

  it("passes one supported non-default event window to the server client", async () => {
    const loadEvents = vi.fn().mockResolvedValue(emptyResult);

    await handleEventsRequest(
      new Request("http://localhost/api/events?window=weekend"),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: undefined, window: "weekend" });
  });

  it.each([
    "window=all",
    "window=year",
    "window=7d&window=30d",
    "window=",
  ])("omits a default or invalid event window: %s", async (query) => {
    const loadEvents = vi.fn().mockResolvedValue(emptyResult);

    await handleEventsRequest(new Request(`http://localhost/api/events?${query}`), loadEvents);

    expect(loadEvents).toHaveBeenCalledWith({ size: undefined });
  });

  it("forwards one normalized activity query and venue ID", async () => {
    const loadEvents = vi.fn().mockResolvedValue(emptyResult);

    await handleEventsRequest(
      new Request("http://localhost/api/events?size=50&q=%20Taylor%20%20Swift%20&venue=venue-1"),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({
      size: 50,
      keyword: "Taylor Swift",
      venueId: "venue-1",
    });
  });

  it.each([
    "q=one&q=two",
    `q=${"a".repeat(101)}`,
    "q=bad%00query",
    "q=Taylor%09Swift",
    "q=Taylor%0ASwift",
    "q=Taylor%C2%85Swift",
    "venue=one&venue=two",
    "venue=bad%20venue",
    "venue=%09venue-1",
    "venue=venue-1%0A",
  ])("does not forward unsafe search input: %s", async (query) => {
    const loadEvents = vi.fn().mockResolvedValue(emptyResult);

    await handleEventsRequest(new Request(`http://localhost/api/events?${query}`), loadEvents);

    expect(loadEvents).toHaveBeenCalledWith({ size: undefined });
  });

  it("forwards one bounded continuation cursor", async () => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 50, totalElements: 81, totalPages: 2, number: 1 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request(
        "http://localhost/api/events?size=50&category=concerts&cursor=opaque-cursor",
      ),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({
      size: 50,
      category: "concerts",
      cursor: "opaque-cursor",
    });
  });

  it.each([
    "cursor=",
    "cursor=%20%20%20",
    "cursor=one&cursor=two",
    `cursor=${"a".repeat(4097)}`,
  ])("does not forward an invalid continuation cursor: %s", async (query) => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 50, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request(`http://localhost/api/events?size=50&${query}`),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: 50 });
  });

  it.each([
    "category=Music",
    "category=concerts&category=theatre",
    "category=",
  ])("does not forward unsupported category input: %s", async (query) => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request(`http://localhost/api/events?size=24&${query}`),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: 24 });
  });

  it.each([
    "size=-1",
    "size=1.5",
    "size=words",
    "size=",
    "size=10&size=20",
  ])("does not forward malformed or duplicated size input: %s", async (query) => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 50, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request(`http://localhost/api/events?${query}`),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: undefined });
  });

  it.each([
    ["size=0", 1],
    ["size=50", 50],
    ["size=999", 50],
  ])("clamps one integer size input to the public range: %s", async (query, expected) => {
    const loadEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: expected, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    await handleEventsRequest(
      new Request(`http://localhost/api/events?${query}`),
      loadEvents,
    );

    expect(loadEvents).toHaveBeenCalledWith({ size: expected });
  });

  it.each([
    ["CONFIG_REQUIRED", 503, "Event data is not configured yet."],
    ["UPSTREAM_AUTH", 502, "Event data is temporarily unavailable."],
    ["UPSTREAM_BUSY", 503, "Event data is busy. Please try again shortly."],
    ["UPSTREAM_TIMEOUT", 504, "Event data took too long to respond."],
    ["UPSTREAM_ERROR", 502, "Event data is temporarily unavailable."],
  ] as const)("returns a safe %s response", async (code, status, message) => {
    const loadEvents = vi.fn().mockRejectedValue(new TicketmasterClientError(code, status));

    const response = await handleEventsRequest(new Request("http://localhost/api/events"), loadEvents);
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: { code, message } });
    expect(JSON.stringify(body)).not.toContain("apikey");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("hides unexpected server failures", async () => {
    const loadEvents = vi.fn().mockRejectedValue(new Error("private internal details"));

    const response = await handleEventsRequest(new Request("http://localhost/api/events"), loadEvents);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Event data is temporarily unavailable." },
    });
    expect(JSON.stringify(body)).not.toContain("private internal details");
  });
});
