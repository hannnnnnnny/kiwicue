import { describe, expect, it } from "vitest";
import { selectOtherSessions, selectRelatedEvents } from "../lib/event-related";
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
  it("suggests other shows, not more dates of this one, and each show once", () => {
    const current = event("cabaret", { name: "Cabaret" });
    const later = (id: string, name: string, day: string) => event(id, { name, start: { ...current.start, localDate: day, dateTime: `${day}T07:00:00Z` } });
    const result = selectRelatedEvents(current, [
      later("cabaret-2", "Cabaret", "2026-09-13"),
      later("musical-1", "Musical", "2026-09-14"),
      later("musical-2", "Musical", "2026-09-15"),
      later("gig", "Gig", "2026-09-16"),
    ], new Date("2026-09-01T00:00:00Z"), 3);
    expect(result.map(({ id }) => id)).toEqual(["musical-1", "gig"]);
  });

  it("lists this show's other upcoming dates in order", () => {
    const current = event("cabaret", { name: "Cabaret" });
    const on = (id: string, day: string, extra: Partial<KiwiCueEvent> = {}) => event(id, { name: "Cabaret", start: { ...current.start, localDate: day, dateTime: `${day}T07:00:00Z` }, ...extra });
    const result = selectOtherSessions(current, [
      on("late", "2026-09-20"),
      on("soon", "2026-09-13"),
      on("elsewhere", "2026-09-14", { venue: { ...current.venue!, id: "town-hall", name: "Town Hall" } }),
      on("gone", "2026-08-01"),
      current,
    ], new Date("2026-09-01T00:00:00Z"));
    expect(result.map(({ id }) => id)).toEqual(["soon", "late"]);
  });

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
