import { describe, expect, it } from "vitest";
import { selectRelatedEvents } from "../lib/event-related";
import type { KiwiCueEvent } from "../lib/events";

function event(id: string, overrides: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id,
    name: id,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: {
      localDate: "2026-09-12",
      localTime: "19:00:00",
      dateTime: "2026-09-12T07:00:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: {
      id: "civic",
      name: "The Civic",
      city: "Auckland",
      address: null,
      postalCode: null,
      coordinates: { latitude: -36.85, longitude: 174.76 },
    },
    ...overrides,
  };
}

describe("related events", () => {
  it("ranks truthful future alternatives by category, venue, area, then date", () => {
    const current = event("current");
    const result = selectRelatedEvents(current, [
      current,
      event("other-category", { category: "Sports" }),
      event("same-area", { venue: { ...current.venue!, id: "town-hall", name: "Town Hall" } }),
      event("same-venue-later", { start: { ...current.start, localDate: "2026-09-20", dateTime: "2026-09-20T07:00:00Z" } }),
      event("cancelled", { status: "cancelled" }),
      event("past", { start: { ...current.start, localDate: "2026-08-01", dateTime: "2026-07-31T20:00:00Z" } }),
    ], new Date("2026-08-28T00:00:00Z"), 3);

    expect(result.map((item) => item.id)).toEqual(["same-venue-later", "same-area", "other-category"]);
  });

  it("deduplicates candidates and enforces a bounded result size", () => {
    const current = event("current");
    const duplicate = event("one");
    expect(selectRelatedEvents(current, [duplicate, duplicate, event("two"), event("three")], new Date("2026-08-28T00:00:00Z"), 2))
      .toHaveLength(2);
  });
});
