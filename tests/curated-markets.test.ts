import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CURATED_MARKET_VERIFIED_AT,
  findCuratedMarketDetail,
  isCuratedMarketId,
  listCuratedMarkets,
  listCuratedMarketVenues,
} from "../lib/curated-markets";

const saturdayEvening = new Date("2026-08-15T08:00:00.000Z");

describe("curated Auckland markets", () => {
  it("returns each verified market once at its next Auckland occurrence", () => {
    const result = listCuratedMarkets({
      now: saturdayEvening,
      window: "all",
      size: 50,
    });

    expect(result.events.length).toBeGreaterThanOrEqual(10);
    expect(new Set(result.events.map((event) => event.id)).size).toBe(
      result.events.length,
    );
    expect(result.events.every((event) => event.category === "Market")).toBe(true);
    expect(result.events.every((event) => event.imageUrl === null)).toBe(true);
    expect(result.nextCursor).toBeNull();
    expect(result.page).toEqual({
      size: 50,
      totalElements: result.events.length,
      totalPages: 1,
      number: 0,
    });
    expect(result.events.map((event) => event.start.dateTime)).toEqual(
      [...result.events]
        .sort((left, right) => {
          const timeDifference = Date.parse(left.start.dateTime ?? "")
            - Date.parse(right.start.dateTime ?? "");
          return timeDifference || left.name.localeCompare(right.name, "en-NZ");
        })
        .map((event) => event.start.dateTime),
    );
  });

  it("uses today's session before opening and next week after opening", () => {
    const before = findCuratedMarketDetail(
      "kc-market-grey-lynn",
      new Date("2026-08-15T20:00:00.000Z"),
    );
    const after = findCuratedMarketDetail(
      "kc-market-grey-lynn",
      new Date("2026-08-16T01:00:00.000Z"),
    );

    expect(before?.start).toMatchObject({
      localDate: "2026-08-16",
      localTime: "08:30:00",
      timezone: "Pacific/Auckland",
    });
    expect(after?.start.localDate).toBe("2026-08-23");
  });

  it("creates the same local opening time across Auckland daylight saving", () => {
    const winter = findCuratedMarketDetail(
      "kc-market-grey-lynn",
      new Date("2026-08-15T19:00:00.000Z"),
    );
    const summer = findCuratedMarketDetail(
      "kc-market-grey-lynn",
      new Date("2026-12-12T18:00:00.000Z"),
    );

    expect(winter?.start.localTime).toBe("08:30:00");
    expect(winter?.start.dateTime).toBe("2026-08-15T20:30:00Z");
    expect(summer?.start.localTime).toBe("08:30:00");
    expect(summer?.start.dateTime).toBe("2026-12-12T19:30:00Z");
  });

  it("filters by keyword, venue, date window, and requested size", () => {
    const keywordResult = listCuratedMarkets({
      now: saturdayEvening,
      window: "all",
      keyword: "  GREY   lynn  ",
      size: 50,
    });
    expect(keywordResult.events.map((event) => event.id)).toEqual([
      "kc-market-grey-lynn",
    ]);

    const venue = listCuratedMarketVenues().find(
      (item) => item.id === "kc-venue-grey-lynn",
    );
    expect(venue).toBeDefined();
    expect(listCuratedMarkets({
      now: saturdayEvening,
      window: "7d",
      venueId: venue?.id,
      size: 50,
    }).events).toHaveLength(1);

    const limited = listCuratedMarkets({
      now: saturdayEvening,
      window: "all",
      size: 2,
    });
    expect(limited.events).toHaveLength(2);
    expect(limited.page.totalElements).toBeGreaterThan(limited.events.length);
    expect(limited.page.totalPages).toBeGreaterThan(1);
  });

  it("returns stable, unique, safely formatted curated venues", () => {
    const venues = listCuratedMarketVenues();

    expect(venues.length).toBeGreaterThanOrEqual(10);
    expect(new Set(venues.map((venue) => venue.id)).size).toBe(venues.length);
    expect(venues.every((venue) => /^[A-Za-z0-9_-]{1,128}$/.test(venue.id))).toBe(true);
    expect(venues.map((venue) => venue.name)).toEqual(
      [...venues.map((venue) => venue.name)].sort((left, right) =>
        left.localeCompare(right, "en-NZ", { sensitivity: "base" }),
      ),
    );
  });

  it("keeps official HTTPS sources, bilingual copy, and a bounded verification age", () => {
    const event = findCuratedMarketDetail(
      "kc-market-grey-lynn",
      saturdayEvening,
    );

    expect(event?.source).toEqual({
      name: "Grey Lynn Farmers Market",
      url: "https://www.greylynnfarmersmarket.co.nz/",
      verifiedAt: CURATED_MARKET_VERIFIED_AT,
    });
    expect(event?.localization?.zh?.name).toBe("Grey Lynn 农夫市集");
    expect(event?.localization?.zh?.description).toContain("本地农产品");
    expect(event?.description).not.toContain("where you can get fresh");
    const verificationAge = (
      Date.parse("2026-08-12T00:00:00.000Z")
      - Date.parse(`${CURATED_MARKET_VERIFIED_AT}T00:00:00.000Z`)
    ) / 86_400_000;
    expect(verificationAge).toBeGreaterThanOrEqual(0);
    expect(verificationAge).toBeLessThanOrEqual(120);
  });

  it("uses a reserved ID namespace and returns null for unknown records", () => {
    expect(isCuratedMarketId("kc-market-grey-lynn")).toBe(true);
    expect(isCuratedMarketId("event-123")).toBe(false);
    expect(findCuratedMarketDetail("kc-market-missing", saturdayEvening)).toBeNull();
  });
});
