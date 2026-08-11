import { describe, expect, it } from "vitest";
import {
  BOOKMARK_STORAGE_KEY,
  MAX_BOOKMARKS,
  parseBookmarks,
  serializeBookmarks,
  toBookmark,
  toggleBookmarkItem,
} from "../lib/bookmarks";
import type { KiwiCueEvent } from "../lib/events";

function event(id = "event-1"): KiwiCueEvent {
  return {
    id,
    name: `Auckland Event ${id}`,
    url: `https://www.ticketmaster.co.nz/event/${id}`,
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
      id: "civic",
      name: "The Civic",
      city: "Auckland",
      address: "269 Queen Street",
      postalCode: "1010",
      coordinates: { latitude: -36.8505, longitude: 174.7645 },
    },
  };
}

describe("local event bookmarks", () => {
  it("uses a versioned app-specific storage key", () => {
    expect(BOOKMARK_STORAGE_KEY).toBe("kiwicue:bookmarks:v1");
    expect(MAX_BOOKMARKS).toBe(100);
  });

  it("round-trips a validated bookmark", () => {
    const saved = toBookmark(event(), "2026-08-01T08:00:00.000Z");

    expect(parseBookmarks(serializeBookmarks([saved]))).toEqual([saved]);
  });

  it("round-trips trusted source and bilingual market metadata", () => {
    const market = {
      ...event("kc-market-grey-lynn"),
      source: {
        name: "Grey Lynn Farmers Market",
        url: "https://www.greylynnfarmersmarket.co.nz/",
        verifiedAt: "2026-08-12",
      },
      localization: {
        zh: {
          name: "Grey Lynn 农夫市集",
          description: "社区农夫市集。",
          note: "出发前请再次确认日程。",
          previewSummary: "第一次去也能快速了解现场。",
          previewHighlights: ["本地农产品", "社区食品商家", "减少废弃物"],
          previewImageAlt: "Grey Lynn 农夫市集里的农产品",
        },
      },
      editorialPreview: {
        summary: "A quick first-visit guide to the market.",
        highlights: ["Local produce", "Food makers", "Low-waste focus"],
        image: {
          url: "https://images.example/grey-lynn.jpg",
          alt: "Fresh produce at Grey Lynn Farmers Market",
          sourceName: "Grey Lynn Farmers Market",
          sourceUrl: "https://www.greylynnfarmersmarket.co.nz/",
          verifiedAt: "2026-08-12",
        },
      },
    } satisfies KiwiCueEvent;
    const saved = toBookmark(market, "2026-08-12T08:00:00.000Z");

    expect(saved.event.source).toEqual(market.source);
    expect(saved.event.localization).toEqual(market.localization);
    expect(saved.event.editorialPreview).toEqual(market.editorialPreview);
    expect(parseBookmarks(serializeBookmarks([saved]))).toEqual([saved]);
  });

  it("drops an unsafe preview image without losing safe preview text", () => {
    const market = {
      ...event("kc-market-grey-lynn"),
      editorialPreview: {
        summary: "A useful first-visit guide.",
        highlights: ["Local produce", "Food makers"],
        image: {
          url: "javascript:alert(1)",
          alt: "Market",
          sourceName: "Official market",
          sourceUrl: "https://example.com/market",
          verifiedAt: "2026-08-12",
        },
      },
    };
    const payload = JSON.stringify({
      version: 1,
      items: [{ event: market, savedAt: "2026-08-12T08:00:00.000Z" }],
    });

    const [saved] = parseBookmarks(payload);
    expect(saved.event.editorialPreview?.summary).toBe("A useful first-visit guide.");
    expect(saved.event.editorialPreview?.highlights).toEqual(["Local produce", "Food makers"]);
    expect(saved.event.editorialPreview?.image).toBeUndefined();
  });

  it("drops malformed optional metadata without losing a valid bookmark", () => {
    const unsafeOptionalMetadata = {
      ...event("kc-market-grey-lynn"),
      source: {
        name: "Official market",
        url: "javascript:alert(1)",
        verifiedAt: "yesterday",
      },
      localization: {
        zh: { name: 42, description: "市集" },
      },
    };
    const payload = JSON.stringify({
      version: 1,
      items: [{ event: unsafeOptionalMetadata, savedAt: "2026-08-12T08:00:00.000Z" }],
    });

    const [saved] = parseBookmarks(payload);
    expect(saved.event.id).toBe("kc-market-grey-lynn");
    expect(saved.event).not.toHaveProperty("source");
    expect(saved.event).not.toHaveProperty("localization");
  });

  it("loads a legacy bookmark while dropping its price range", () => {
    const legacyEvent = {
      ...event(),
      priceRange: { currency: "NZD", minimum: 49, maximum: 129 },
    };
    const serialized = JSON.stringify({
      version: 1,
      items: [{ event: legacyEvent, savedAt: "2026-08-01T08:00:00.000Z" }],
    });

    expect(parseBookmarks(serialized)).toHaveLength(1);
    expect(parseBookmarks(serialized)[0]?.event).not.toHaveProperty("priceRange");
  });

  it.each([
    ["missing", null],
    ["invalid JSON", "not-json"],
    ["obsolete version", JSON.stringify({ version: 0, items: [] })],
    ["invalid shape", JSON.stringify({ version: 1, items: {} })],
  ])("returns an empty safe list for %s storage", (_label, input) => {
    expect(parseBookmarks(input)).toEqual([]);
  });

  it("discards events with unsafe URLs, IDs, dates, or coordinates", () => {
    const unsafeEvents = [
      { ...event(), id: "../secret" },
      { ...event(), url: "javascript:alert(1)" },
      { ...event(), imageUrl: "data:text/html,bad" },
      { ...event(), start: { ...event().start, localDate: "not-a-date" } },
      {
        ...event(),
        venue: { ...event().venue!, coordinates: { latitude: 200, longitude: 174 } },
      },
    ];
    const payload = JSON.stringify({
      version: 1,
      items: unsafeEvents.map((unsafeEvent) => ({
        event: unsafeEvent,
        savedAt: "2026-08-01T08:00:00.000Z",
      })),
    });

    expect(parseBookmarks(payload)).toEqual([]);
  });

  it("keeps the newest duplicate, sorts newest first, and caps the list", () => {
    const items = Array.from({ length: 105 }, (_, index) => ({
      event: event(`event-${index}`),
      savedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }));
    items.push({ event: { ...event("event-50"), name: "Newest copy" }, savedAt: "2026-12-01T00:00:00.000Z" });

    const parsed = parseBookmarks(JSON.stringify({ version: 1, items }));

    expect(parsed).toHaveLength(100);
    expect(parsed[0].event.name).toBe("Newest copy");
    expect(new Set(parsed.map((bookmark) => bookmark.event.id)).size).toBe(100);
  });

  it("adds a new bookmark first and removes an existing bookmark", () => {
    const first = toBookmark(event("event-1"), "2026-08-01T08:00:00.000Z");

    const added = toggleBookmarkItem([first], event("event-2"), "2026-08-02T08:00:00.000Z");
    expect(added.map((bookmark) => bookmark.event.id)).toEqual(["event-2", "event-1"]);
    expect(toggleBookmarkItem(added, event("event-1"))).toEqual([added[0]]);
  });

  it("rejects invalid data before it can be stored", () => {
    expect(() => toBookmark({ ...event(), url: "http://example.com" })).toThrow(RangeError);
    expect(() => serializeBookmarks([{ event: { ...event(), id: "bad/id" }, savedAt: new Date().toISOString() }])).toThrow(RangeError);
  });
});
