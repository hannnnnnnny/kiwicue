import { describe, expect, it } from "vitest";
import { rankForYou } from "../lib/social/for-you-ranking";
import { makeEvent } from "./fixtures/social-event";

describe("For You ranking", () => {
  it("favors an explicitly selected interest and explains it honestly", () => {
    const music = makeEvent("music");
    const market = { ...makeEvent("market"), category: "Market" };
    const results = rankForYou([market, music], { interests: ["live-music"], savedCategories: [] }, new Date("2026-09-23T00:00:00Z"));
    expect(results[0].event.id).toBe("music");
    expect(results[0].reason).toBe("interest");
  });

  it("filters cancelled and past events", () => {
    const cancelled = { ...makeEvent("cancelled"), status: "cancelled" };
    const results = rankForYou([cancelled], { interests: [], savedCategories: [] }, new Date("2026-09-23T00:00:00Z"));
    expect(results).toEqual([]);
  });
  it("uses Auckland daylight-saving time for events without a UTC timestamp", () => {
    const event = makeEvent("late-show");
    event.start = { ...event.start, dateTime: null, localDate: "2026-10-01", localTime: "23:00:00" };
    const ranked = rankForYou([event], { interests: [], savedCategories: [] }, new Date("2026-10-01T10:30:00Z"));
    expect(ranked).toEqual([]);
  });
});
