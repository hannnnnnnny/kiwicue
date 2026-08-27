import { describe, expect, it } from "vitest";
import type { KiwiCueEvent } from "../lib/events";
import { buildEventRecommendations } from "../lib/event-recommendations";

const NOW = new Date("2026-08-28T00:00:00.000Z");

function event(
  id: string,
  dateTime: string,
  options: Partial<KiwiCueEvent> = {},
): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    start: {
      localDate: dateTime.slice(0, 10),
      localTime: dateTime.slice(11, 19),
      dateTime,
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: {
      id: `venue-${id}`,
      name: `Venue ${id}`,
      city: "Auckland",
      address: null,
      postalCode: null,
      coordinates: null,
    },
    source: {
      name: "Ticketmaster NZ",
      url: `https://example.com/source/${id}`,
      verifiedAt: "2026-08-27T00:00:00.000Z",
    },
    ...options,
  };
}

function recommendedIds(result: ReturnType<typeof buildEventRecommendations>) {
  return [
    ...result.startHere,
    ...result.weekend,
    ...result.somethingDifferent,
  ].map((item) => item.event.id);
}

describe("buildEventRecommendations", () => {
  it("excludes saved, past, invalid and unavailable events from every section", () => {
    const saved = event("saved", "2026-08-30T07:00:00.000Z");
    const result = buildEventRecommendations({
      events: [
        saved,
        event("past", "2026-08-20T07:00:00.000Z"),
        event("cancelled", "2026-08-30T07:00:00.000Z", { status: "cancelled" }),
        event("postponed", "2026-08-30T07:00:00.000Z", { status: "postponed" }),
        event("invalid", "not-a-date"),
        event("valid", "2026-08-31T07:00:00.000Z"),
      ],
      savedEvents: [saved],
      now: NOW,
    });

    expect(recommendedIds(result)).toEqual(["valid"]);
  });

  it("uses saved categories and venues as local affinity signals with an explanation", () => {
    const saved = event("saved", "2026-09-10T07:00:00.000Z", {
      venue: { id: "fav", name: "Favourite", city: "Auckland", address: null, postalCode: null, coordinates: null },
    });
    const familiar = event("familiar", "2026-09-15T07:00:00.000Z", {
      venue: { id: "fav", name: "Favourite", city: "Auckland", address: null, postalCode: null, coordinates: null },
    });
    const sooner = event("sooner", "2026-08-29T07:00:00.000Z", { category: "Sports" });

    const result = buildEventRecommendations({ events: [sooner, familiar], savedEvents: [saved], now: NOW });

    expect(result.startHere[0]).toMatchObject({ event: { id: "familiar" }, reason: "saved-affinity" });
  });

  it("builds a dedicated Auckland-weekend section and never duplicates events", () => {
    const result = buildEventRecommendations({
      events: [
        event("sat", "2026-08-29T02:00:00.000Z"),
        event("sun", "2026-08-30T02:00:00.000Z", { category: "Sports" }),
        event("monday", "2026-08-31T02:00:00.000Z", { category: "Arts & Theatre" }),
        event("sat-later", "2026-08-29T05:00:00.000Z", { category: "Market" }),
        event("sun-later", "2026-08-30T05:00:00.000Z", { category: "Festival" }),
      ],
      savedEvents: [],
      now: NOW,
    });

    expect(result.startHere.map((item) => item.event.id)).toEqual(["sat", "sat-later", "sun"]);
    expect(result.weekend.map((item) => item.event.id)).toEqual(["sun-later"]);
    expect(new Set(recommendedIds(result)).size).toBe(recommendedIds(result).length);
  });

  it("keeps the lead selection diverse by category and venue before filling remaining slots", () => {
    const events = [
      event("music-a", "2026-09-01T07:00:00.000Z", { venue: { id: "same", name: "Same", city: "Auckland", address: null, postalCode: null, coordinates: null } }),
      event("music-b", "2026-09-02T07:00:00.000Z", { venue: { id: "same", name: "Same", city: "Auckland", address: null, postalCode: null, coordinates: null } }),
      event("sport", "2026-09-03T07:00:00.000Z", { category: "Sports" }),
      event("theatre", "2026-09-04T07:00:00.000Z", { category: "Arts & Theatre" }),
    ];

    const result = buildEventRecommendations({ events, savedEvents: [], now: NOW });

    expect(result.startHere.map((item) => item.event.id)).toEqual(["music-a", "sport", "theatre"]);
  });

  it("uses deterministic ordering and recommends a different category from the saved majority", () => {
    const savedEvents = [
      event("saved-a", "2026-09-10T07:00:00.000Z"),
      event("saved-b", "2026-09-11T07:00:00.000Z"),
    ];
    const events = [
      event("z", "2026-09-08T07:00:00.000Z", { name: "Zulu" }),
      event("a", "2026-09-08T07:00:00.000Z", { name: "Alpha" }),
      event("sport", "2026-09-09T07:00:00.000Z", { category: "Sports" }),
      event("market", "2026-09-12T07:00:00.000Z", { category: "Market" }),
      event("theatre", "2026-09-13T07:00:00.000Z", { category: "Arts & Theatre" }),
      event("sport-later", "2026-09-14T07:00:00.000Z", { category: "Sports" }),
    ];

    const first = buildEventRecommendations({ events, savedEvents, now: NOW });
    const second = buildEventRecommendations({ events: [...events].reverse(), savedEvents, now: NOW });

    expect(first.startHere.map((item) => item.event.id)).toEqual(second.startHere.map((item) => item.event.id));
    expect(first.somethingDifferent.map((item) => item.event.category)).not.toContain("Music");
  });

  it("builds a broad, diverse something-different section without saved history", () => {
    const result = buildEventRecommendations({
      events: [
        event("music", "2026-09-07T07:00:00.000Z"),
        event("sport", "2026-09-08T07:00:00.000Z", { category: "Sports" }),
        event("theatre", "2026-09-09T07:00:00.000Z", { category: "Arts & Theatre" }),
        event("market", "2026-09-10T07:00:00.000Z", { category: "Market" }),
        event("festival", "2026-09-11T07:00:00.000Z", { category: "Festival" }),
      ],
      savedEvents: [],
      now: NOW,
    });

    expect(result.startHere).toHaveLength(3);
    expect(result.somethingDifferent.map((item) => item.event.id)).toEqual(["market", "festival"]);
  });

  it("uses truthful reasons for sparse events and recognises verified market availability", () => {
    const sparse = event("sparse", "2026-09-20T07:00:00.000Z", {
      imageUrl: null,
      source: undefined,
      venue: null,
      status: "unknown",
    });
    const market = event("market", "2026-09-21T07:00:00.000Z", {
      category: "Market",
      imageUrl: null,
      status: "schedule_verified",
    });

    const result = buildEventRecommendations({ events: [sparse, market], savedEvents: [], now: NOW });

    expect(result.startHere[0]).toMatchObject({ event: { id: "market" }, reason: "verified" });
    expect(result.startHere[1]).toMatchObject({ event: { id: "sparse" }, reason: "upcoming" });
  });
});
