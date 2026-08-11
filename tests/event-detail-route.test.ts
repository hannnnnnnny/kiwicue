import { describe, expect, it, vi } from "vitest";
import type { KiwiCueEventDetail } from "../lib/events";
import { TicketmasterClientError } from "../lib/ticketmaster";
import { handleEventDetailRequest } from "../app/api/events/[eventId]/route";

const detail: KiwiCueEventDetail = {
  id: "event-123",
  name: "Auckland Night Live",
  url: "https://www.ticketmaster.co.nz/event/event-123",
  imageUrl: "https://img.example/event.jpg",
  start: {
    localDate: "2026-08-08",
    localTime: "19:30:00",
    dateTime: "2026-08-08T07:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "onsale",
  category: "Music",
  venue: {
    id: "venue-civic",
    name: "The Civic",
    city: "Auckland",
    address: "269 Queen Street",
    postalCode: "1010",
    coordinates: { latitude: -36.8505, longitude: 174.7645 },
  },
  description: "Doors open at 6:30 pm.",
  note: "Age restrictions may apply.",
};

describe("GET /api/events/[eventId]", () => {
  it("returns one normalized detail with a shared cache policy", async () => {
    const loadDetail = vi.fn().mockResolvedValue(detail);

    const response = await handleEventDetailRequest("event-123", loadDetail);

    expect(loadDetail).toHaveBeenCalledWith({ eventId: "event-123" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.json()).toEqual({ event: detail });
  });

  it("loads a reserved curated detail locally without calling Ticketmaster", async () => {
    const loadDetail = vi.fn();
    const curatedDetail = {
      ...detail,
      id: "kc-market-grey-lynn",
      name: "Grey Lynn Farmers Market",
      url: "https://www.greylynnfarmersmarket.co.nz/",
    };
    const findCuratedDetail = vi.fn().mockReturnValue(curatedDetail);

    const response = await handleEventDetailRequest(
      "kc-market-grey-lynn",
      loadDetail,
      findCuratedDetail,
    );

    expect(loadDetail).not.toHaveBeenCalled();
    expect(findCuratedDetail).toHaveBeenCalledWith("kc-market-grey-lynn");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ event: curatedDetail });
  });

  it("returns a safe 404 for an unknown curated ID without falling through", async () => {
    const loadDetail = vi.fn();
    const findCuratedDetail = vi.fn().mockReturnValue(null);

    const response = await handleEventDetailRequest(
      "kc-market-missing",
      loadDetail,
      findCuratedDetail,
    );

    expect(loadDetail).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "UPSTREAM_NOT_FOUND", message: "Event not found." },
    });
  });

  it.each(["../secret", "event/123", "", "a".repeat(129)])(
    "rejects an unsafe event ID before loading: %s",
    async (eventId) => {
      const loadDetail = vi.fn();

      const response = await handleEventDetailRequest(eventId, loadDetail);

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: { code: "INVALID_EVENT_ID", message: "Invalid event ID." },
      });
      expect(loadDetail).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["UPSTREAM_NOT_FOUND", 404, "Event not found."],
    ["CONFIG_REQUIRED", 503, "Event data is not configured yet."],
    ["UPSTREAM_AUTH", 502, "Event data is temporarily unavailable."],
    ["UPSTREAM_BUSY", 503, "Event data is busy. Please try again shortly."],
    ["UPSTREAM_TIMEOUT", 504, "Event data took too long to respond."],
    ["UPSTREAM_ERROR", 502, "Event data is temporarily unavailable."],
  ] as const)("returns a safe %s response", async (code, status, message) => {
    const loadDetail = vi.fn().mockRejectedValue(new TicketmasterClientError(code, status));

    const response = await handleEventDetailRequest("event-123", loadDetail);
    const body = await response.json();

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: { code, message } });
    expect(JSON.stringify(body)).not.toContain("apikey");
    expect(JSON.stringify(body)).not.toContain("stack");
  });

  it("hides unexpected server failures", async () => {
    const loadDetail = vi.fn().mockRejectedValue(new Error("private upstream body"));

    const response = await handleEventDetailRequest("event-123", loadDetail);

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Event data is temporarily unavailable." },
    });
  });
});
