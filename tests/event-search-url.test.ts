import { describe, expect, it } from "vitest";
import { eventSearchHref } from "../lib/event-search-url";

describe("event portal URLs", () => {
  it("builds stable shareable URLs in canonical order", () => {
    expect(eventSearchHref({
      window: "weekend",
      category: "concerts",
      keyword: "Taylor Swift",
      venueId: "venue-1",
      sort: "date",
    })).toBe("/events?window=weekend&category=concerts&q=Taylor+Swift&venue=venue-1&sort=date");
  });

  it("omits every default or empty value", () => {
    expect(eventSearchHref({
      window: "all",
      category: null,
      keyword: null,
      venueId: null,
      sort: "recommended",
    })).toBe("/events");
  });
});
