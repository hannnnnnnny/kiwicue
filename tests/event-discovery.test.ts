import { describe, expect, it } from "vitest";
import {
  buildEventDiscovery,
  deriveEventArea,
  groupEventsByAucklandDate,
  sortDiscoveryEvents,
} from "../lib/event-discovery";
import type { KiwiCueEvent } from "../lib/events";

const NOW = new Date("2026-08-28T00:00:00.000Z");

function event(id: string, options: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: {
      localDate: "2026-08-29",
      localTime: "19:00:00",
      dateTime: "2026-08-29T07:00:00.000Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
    ...options,
  };
}

describe("event discovery derivation", () => {
  it("uses deterministic completeness ordering without popularity claims", () => {
    const sparse = event("sparse");
    const complete = event("complete", {
      imageUrl: "https://example.com/complete.jpg",
      venue: { id: "v1", name: "Civic", city: "Auckland", address: null, postalCode: null, coordinates: null },
    });
    const curated = event("curated", {
      editorialPreview: { summary: "Verified preview", highlights: [] },
      source: { name: "Official", url: "https://example.com/source", verifiedAt: "2026-08-28" },
    });
    expect(sortDiscoveryEvents([sparse, complete, curated], "recommended").map(({ id }) => id))
      .toEqual([curated.id, complete.id, sparse.id]);
  });

  it("requires explicit evidence for picks and free events", () => {
    const free = event("free", { admission: { kind: "free", currency: "NZD" } });
    const unknown = event("unknown", { admission: { kind: "unknown" } });
    const curated = event("curated", { source: { name: "Official", url: "https://example.com", verifiedAt: "2026-08-28" } });
    const result = buildEventDiscovery([free, unknown, curated], NOW);
    expect(result.free.map(({ id }) => id)).toEqual([free.id]);
    expect(result.picks.map(({ id }) => id)).toEqual([curated.id]);
  });

  it("groups in chronological Auckland local-date order", () => {
    const later = event("later", { start: { localDate: "2026-08-30", localTime: "01:00:00", dateTime: "2026-08-29T13:00:00Z", timezone: "Pacific/Auckland" } });
    const earlier = event("earlier");
    expect(groupEventsByAucklandDate([later, earlier]).map(({ date }) => date))
      .toEqual(["2026-08-29", "2026-08-30"]);
  });

  it("maps only finite coordinates inside the Auckland discovery bounds", () => {
    const at = (latitude: number, longitude: number) => event("area", {
      venue: { id: "v", name: "Venue", city: "Auckland", address: null, postalCode: null, coordinates: { latitude, longitude } },
    });
    expect(deriveEventArea(at(-36.8485, 174.7633))).toBe("central");
    expect(deriveEventArea(at(-36.782, 174.756))).toBe("north");
    expect(deriveEventArea(at(-36.889, 174.62))).toBe("west");
    expect(deriveEventArea(at(-37.01, 174.79))).toBe("south");
    expect(deriveEventArea(at(-36.9, 174.9))).toBe("east");
    expect(deriveEventArea(at(0, 0))).toBeNull();
  });

  it("excludes past, blocked, invalid and duplicate events", () => {
    const valid = event("valid");
    const result = buildEventDiscovery([
      valid,
      valid,
      event("past", { start: { localDate: "2026-08-20", localTime: null, dateTime: "2026-08-20T00:00:00Z", timezone: "Pacific/Auckland" } }),
      event("cancelled", { status: "cancelled" }),
      event("invalid", { start: { localDate: "bad", localTime: null, dateTime: null, timezone: "Pacific/Auckland" } }),
    ], NOW);
    expect(result.dateGroups.flatMap(({ events }) => events).map(({ id }) => id)).toEqual(["valid"]);
  });
});
