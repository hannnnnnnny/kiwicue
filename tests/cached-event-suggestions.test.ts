import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (loader: unknown) => loader,
}));

import { loadEventNameSuggestions } from "../lib/cached-event-suggestions";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";

const market: KiwiCueEvent = {
  id: "kc-market-grey-lynn",
  name: "Grey Lynn Farmers Market",
  url: "https://www.greylynnfarmersmarket.co.nz/",
  imageUrl: null,
  start: {
    localDate: "2026-08-16",
    localTime: "08:30:00",
    dateTime: "2026-08-15T20:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "schedule_verified",
  category: "Market",
  venue: {
    id: "kc-venue-grey-lynn",
    name: "Grey Lynn Community Centre",
    city: "Auckland",
    address: "510 Richmond Road, Grey Lynn",
    postalCode: "1022",
    coordinates: null,
  },
};

describe("loadEventNameSuggestions", () => {
  it("uses curated market data without loading the Ticketmaster catalogue", async () => {
    const loadCatalog = vi.fn();
    const loadMarkets = vi.fn().mockReturnValue({
      events: [market],
      page: { size: 6, totalElements: 1, totalPages: 1, number: 0 },
      nextCursor: null,
    } satisfies AucklandEventsResult);

    await expect(loadEventNameSuggestions({
      query: "grey",
      limit: 6,
      window: "30d",
      category: "markets",
      venueId: "kc-venue-grey-lynn",
    }, { loadCatalog, loadMarkets })).resolves.toEqual([{
      name: "Grey Lynn Farmers Market",
      category: "Market",
      localDate: "2026-08-16",
      venueName: "Grey Lynn Community Centre",
    }]);
    expect(loadCatalog).not.toHaveBeenCalled();
    expect(loadMarkets).toHaveBeenCalledWith({
      keyword: "grey",
      size: 6,
      window: "30d",
      venueId: "kc-venue-grey-lynn",
    });
  });

  it("keeps existing catalogue loading for Ticketmaster categories", async () => {
    const loadCatalog = vi.fn().mockResolvedValue([{ ...market, category: "Music" }]);
    const loadMarkets = vi.fn();

    await loadEventNameSuggestions({
      query: "grey",
      limit: 6,
      window: "all",
      category: "concerts",
    }, { loadCatalog, loadMarkets });

    expect(loadCatalog).toHaveBeenCalledWith("all", "concerts");
    expect(loadMarkets).not.toHaveBeenCalled();
  });
});
