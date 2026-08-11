import { describe, expect, it, vi } from "vitest";
import type { KiwiCueEvent } from "../lib/events";
import { collectEventSuggestionCatalog } from "../lib/event-suggestion-catalog";
import { suggestEventNames, suggestEventNamesForVenue } from "../lib/event-suggestions";

function event(
  id: string,
  name: string,
  localDate: string,
  venueId = "spark-arena",
): KiwiCueEvent {
  return {
    id,
    name,
    url: `https://www.ticketmaster.co.nz/event/${id}`,
    imageUrl: null,
    start: {
      localDate,
      localTime: "19:30:00",
      dateTime: `${localDate}T07:30:00Z`,
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: {
      id: venueId,
      name: venueId === "spark-arena" ? "Spark Arena" : "The Civic",
      city: "Auckland",
      address: null,
      postalCode: null,
      coordinates: null,
    },
  };
}

describe("suggestEventNames", () => {
  it("matches partial names without case or accent sensitivity and removes duplicates", () => {
    const events = [
      event("laufey-1", "Laufey - A Matter Of Time Tour", "2026-08-14"),
      event("cafe", "Café Culture Night", "2026-08-15"),
      event("laufey-2", "Laufey - A Matter Of Time Tour", "2026-08-16"),
    ];

    expect(suggestEventNames(events, "LAUF", 6)).toEqual([
      {
        name: "Laufey - A Matter Of Time Tour",
        category: "Music",
        localDate: "2026-08-14",
        venueName: "Spark Arena",
      },
    ]);
    expect(suggestEventNames(events, "cafe", 6)[0]?.name).toBe("Café Culture Night");
  });

  it("applies a venue constraint to the cached catalogue before matching names", () => {
    const events = [
      event("spark", "Night Music", "2026-08-14"),
      event("civic", "Night Theatre", "2026-08-15", "the-civic"),
    ];

    expect(suggestEventNamesForVenue(events, "night", 6, "the-civic"))
      .toEqual([{
        name: "Night Theatre",
        category: "Music",
        localDate: "2026-08-15",
        venueName: "The Civic",
      }]);
  });
});

describe("collectEventSuggestionCatalog", () => {
  it("collects every cursor page while preserving the selected filters", async () => {
    const first = event("first", "First Event", "2026-08-14");
    const second = event("second", "Second Event", "2026-08-15");
    const loadFeed = vi.fn()
      .mockResolvedValueOnce({
        events: [first],
        page: { size: 50, totalElements: 2, totalPages: 2, number: 0 },
        nextCursor: "safe-cursor",
      })
      .mockResolvedValueOnce({
        events: [second],
        page: { size: 50, totalElements: 2, totalPages: 2, number: 1 },
        nextCursor: null,
      });

    const result = await collectEventSuggestionCatalog({
      window: "30d",
      category: "concerts",
      venueId: "spark-arena",
      loadFeed,
    });

    expect(result).toEqual([first, second]);
    expect(loadFeed).toHaveBeenNthCalledWith(1, {
      size: 50,
      window: "30d",
      category: "concerts",
      venueId: "spark-arena",
    });
    expect(loadFeed).toHaveBeenNthCalledWith(2, {
      size: 50,
      window: "30d",
      category: "concerts",
      venueId: "spark-arena",
      cursor: "safe-cursor",
    });
  });

  it("continues beyond twenty pages instead of dropping a large catalogue", async () => {
    let page = 0;
    const loadFeed = vi.fn().mockImplementation(async () => {
      page += 1;
      return {
        events: [event(`event-${page}`, `Event ${page}`, "2026-08-14")],
        page: { size: 50, totalElements: 21, totalPages: 21, number: page - 1 },
        nextCursor: page < 21 ? `cursor-${page}` : null,
      };
    });

    const result = await collectEventSuggestionCatalog({ window: "all", loadFeed });

    expect(result).toHaveLength(21);
    expect(loadFeed).toHaveBeenCalledTimes(21);
  });
});
