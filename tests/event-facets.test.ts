import { describe, expect, it } from "vitest";
import { buildEventFacetOptions, filterEventFacet } from "../lib/event-facets";
import type { KiwiCueEvent } from "../lib/events";

function event(id: string, overrides: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id,
    name: id,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: {
      localDate: "2099-09-01",
      localTime: "19:00:00",
      dateTime: "2099-09-01T07:00:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
    ...overrides,
  };
}

describe("loaded event refinements", () => {
  it("only offers facets represented by the loaded records", () => {
    const events = [
      event("guide", {
        id: "1Ae8Z_oGkwOKdBs",
        tags: ["Rock", "Alternative", "Rock"],
        venue: { id: "civic", name: "The Civic", city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.8505, longitude: 174.7645 } },
      }),
      event("plain", { tags: ["Jazz"], venue: { id: "north", name: "North venue", city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.782, longitude: 174.756 } } }),
    ];
    const options = buildEventFacetOptions(events);
    expect(options.map((option) => option.label)).toEqual([
      "All loaded", "With a guide", "Previous reference", "Central Auckland", "North Auckland", "Rock", "Alternative", "Jazz",
    ]);
    expect(options.find((option) => option.label === "Rock")?.count).toBe(1);
  });

  it("filters by guide, previous reference, area and encoded tag without changing the source list", () => {
    const guide = event("1Ae8Z_oGkwOKdBs", {
      tags: ["Rock"],
      venue: { id: "civic", name: "The Civic", city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.8505, longitude: 174.7645 } },
    });
    const plain = event("plain", { tags: ["Jazz"] });
    const events = [guide, plain];
    expect(filterEventFacet(events, "guide")).toEqual([guide]);
    expect(filterEventFacet(events, "reference")).toEqual([guide]);
    expect(filterEventFacet(events, "area:central")).toEqual([guide]);
    expect(filterEventFacet(events, "tag:Rock")).toEqual([guide]);
    expect(filterEventFacet(events, "all")).toBe(events);
  });
});
