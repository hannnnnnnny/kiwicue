import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { collectAucklandVenues, type VenueFeedLoader } from "../lib/venue-catalog";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";

const now = new Date("2026-07-29T00:00:00.000Z");

function event(
  id: string,
  venue: { id: string; name: string } | null,
): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://ticketmaster.co.nz/${id}`,
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
    venue: venue
      ? { ...venue, city: "Auckland", address: null, postalCode: null, coordinates: null }
      : null,
  };
}

function result(events: KiwiCueEvent[], nextCursor: string | null): AucklandEventsResult {
  return {
    events,
    page: { size: 50, totalElements: events.length, totalPages: 1, number: 0 },
    nextCursor,
  };
}

describe("collectAucklandVenues", () => {
  it("exhausts the feed, excludes missing venues, deduplicates IDs, and sorts names", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const loadFeed = vi.fn<VenueFeedLoader>()
      .mockResolvedValueOnce(result([
        event("1", { id: "b", name: "Spark Arena" }),
        event("2", null),
      ], "next"))
      .mockResolvedValueOnce(result([
        event("3", { id: "a", name: "Aotea Centre" }),
        event("4", { id: "b", name: "Renamed duplicate" }),
      ], null));

    await expect(collectAucklandVenues({ apiKey: "test-key", now, loadFeed, wait })).resolves.toEqual([
      { id: "a", name: "Aotea Centre" },
      { id: "b", name: "Spark Arena" },
    ]);
    expect(loadFeed).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "next", now }));
    expect(wait).toHaveBeenCalledWith(200);
  });

  it("fails closed instead of returning a partial catalogue after 128 batches", async () => {
    let batch = 0;
    const loadFeed = vi.fn<VenueFeedLoader>().mockImplementation(async () => {
      batch += 1;
      return result([], `cursor-${batch}`);
    });
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(collectAucklandVenues({
      apiKey: "test-key",
      now,
      loadFeed,
      maxBatches: 128,
      wait,
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(loadFeed).toHaveBeenCalledTimes(128);
    expect(wait).toHaveBeenCalledTimes(127);
  });

  it("excludes malformed venues and returns trimmed venue names", async () => {
    const loadFeed = vi.fn<VenueFeedLoader>().mockResolvedValue(result([
      event("1", { id: "invalid venue id", name: "Invalid ID" }),
      event("2", { id: "blank", name: "" }),
      event("3", { id: "whitespace", name: "  \t  " }),
      event("4", { id: "valid_venue-1", name: "  The Powerstation  " }),
    ], null));

    await expect(collectAucklandVenues({ apiKey: "test-key", now, loadFeed })).resolves.toEqual([
      { id: "valid_venue-1", name: "The Powerstation" },
    ]);
  });

  it("fails before waiting or loading a repeated continuation cursor", async () => {
    const loadFeed = vi.fn<VenueFeedLoader>()
      .mockResolvedValueOnce(result([], "repeat"))
      .mockResolvedValueOnce(result([], "repeat"));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(collectAucklandVenues({ apiKey: "test-key", now, loadFeed, wait }))
      .rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(loadFeed).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
