import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decodeEventFeedCursor, encodeEventFeedCursor } from "../lib/event-feed-cursor";
import {
  fetchAucklandEventFeed,
  type TicketmasterPageLoader,
} from "../lib/ticketmaster-event-feed";
import type { KiwiCueEvent, TicketmasterPageResult } from "../lib/events";

const now = new Date("2026-07-29T00:00:00.000Z");

function event(id: string, localDate = "2026-08-01"): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://www.ticketmaster.co.nz/event/${id}`,
    imageUrl: null,
    start: {
      localDate,
      localTime: null,
      dateTime: null,
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
  };
}

function pageResult(
  events: KiwiCueEvent[],
  page: number,
  totalElements: number,
  totalPages: number,
): TicketmasterPageResult {
  return {
    events,
    page: { size: 50, number: page, totalElements, totalPages },
  };
}

describe("Ticketmaster unbounded event feed", () => {
  it("continues an under-1000 feed without an end date", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async ({ page, endDateTime }) => {
      expect(endDateTime).toBeUndefined();
      return page === 0
        ? pageResult([event("first")], 0, 81, 2)
        : pageResult([event("last")], 1, 81, 2);
    });

    const first = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });
    const second = await fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      cursor: first.nextCursor ?? "",
      loadPage,
    });

    expect(first.page.totalElements).toBe(81);
    expect(second.events.map(({ id }) => id)).toEqual(["last"]);
    expect(second.nextCursor).toBeNull();
    expect(loadPage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      startDateTime: now,
      sort: "date,asc",
      page: 0,
      size: 50,
    }));
  });

  it("allows exactly 1000 results without probing or deep paging", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async ({ page }) =>
      pageResult([event(`page-${page}`)], page, 1000, 20),
    );

    const result = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });
    const cursor = decodeEventFeedCursor(result.nextCursor ?? "", "test-key", now);

    expect(loadPage).toHaveBeenCalledOnce();
    expect(cursor?.page).toBe(1);
    expect(cursor?.horizonEnd).toBeNull();
    expect(loadPage.mock.calls.every(([options]) => options.size * options.page < 1000)).toBe(true);
  });

  it("finds the farthest event before splitting an oversized unbounded feed", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) => {
      if (!options.endDateTime && options.sort !== "date,desc") {
        return pageResult([], 0, 1201, 25);
      }
      if (options.sort === "date,desc") {
        return pageResult([event("farthest", "2028-02-10")], 0, 1201, 25);
      }
      return pageResult([event("month")], 0, 1, 1);
    });

    const result = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });

    expect(result.page.totalElements).toBe(1201);
    expect(loadPage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      size: 1,
      sort: "date,desc",
      endDateTime: undefined,
    }));
    expect(loadPage.mock.calls[2][0].endDateTime?.toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
    const cursor = decodeEventFeedCursor(result.nextCursor ?? "", "test-key", now);
    expect(cursor?.horizonEnd).toBe("2028-02-12T00:00:00.000Z");
  });

  it("keeps a far-future horizon in a compact cursor instead of queuing every month", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) => {
      if (!options.endDateTime && options.sort !== "date,desc") {
        return pageResult([], 0, 1201, 25);
      }
      if (options.sort === "date,desc") {
        return pageResult([event("farthest", "2035-12-20")], 0, 1201, 25);
      }
      return pageResult([event("first-month")], 0, 1, 1);
    });

    const result = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });
    const cursor = decodeEventFeedCursor(result.nextCursor ?? "", "test-key", now);
    expect(cursor?.horizonEnd).toBe("2035-12-22T00:00:00.000Z");
    expect(cursor?.ranges).toHaveLength(1);
    expect((result.nextCursor ?? "").length).toBeLessThan(4096);
  });

  it("walks adjacent calendar ranges without materializing the remaining horizon", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) => {
      if (!options.endDateTime) {
        return options.sort === "date,desc"
          ? pageResult([event("farthest", "2026-09-15")], 0, 1201, 25)
          : pageResult([], 0, 1201, 25);
      }
      return pageResult([event("range")], 0, 1, 1);
    });

    const first = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });
    const firstCursor = decodeEventFeedCursor(first.nextCursor ?? "", "test-key", now);
    expect(firstCursor?.ranges).toEqual([{
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    }]);

    const second = await fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      cursor: first.nextCursor ?? "",
      loadPage,
    });
    const secondCursor = decodeEventFeedCursor(second.nextCursor ?? "", "test-key", now);
    expect(secondCursor?.ranges).toEqual([{
      start: "2026-09-01T00:00:00.000Z",
      end: "2026-09-17T00:00:00.000Z",
    }]);
  });

  it("bisects an exceptional month that still exceeds the deep-page limit", async () => {
    const firstMonthEnd = new Date("2026-08-01T00:00:00.000Z");
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) => {
      if (!options.endDateTime) {
        return options.sort === "date,desc"
          ? pageResult([event("farthest", "2026-08-20")], 0, 1201, 25)
          : pageResult([], 0, 1201, 25);
      }
      if (
        options.startDateTime.getTime() === now.getTime() &&
        options.endDateTime.getTime() === firstMonthEnd.getTime()
      ) {
        return pageResult([], options.page, 1001, 21);
      }
      return pageResult([event("split-month")], options.page, 1, 1);
    });

    const result = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });

    expect(result.events).toEqual([event("split-month")]);
    expect(loadPage).toHaveBeenCalledTimes(4);
    const splitCall = loadPage.mock.calls[3][0];
    expect(splitCall.startDateTime).toEqual(now);
    expect(splitCall.endDateTime?.getTime()).toBeGreaterThan(now.getTime());
    expect(splitCall.endDateTime?.getTime()).toBeLessThan(firstMonthEnd.getTime());
  });

  it("skips empty ranges and preserves the original total", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) => {
      if (!options.endDateTime) {
        return options.sort === "date,desc"
          ? pageResult([event("farthest", "2026-09-02")], 0, 1201, 25)
          : pageResult([], 0, 1201, 25);
      }
      if (options.endDateTime.toISOString() === "2026-08-01T00:00:00.000Z") {
        return pageResult([], 0, 0, 0);
      }
      return pageResult([event("after-empty")], 0, 1, 1);
    });

    const result = await fetchAucklandEventFeed({ apiKey: "test-key", now, loadPage });

    expect(result.events.map(({ id }) => id)).toEqual(["after-empty"]);
    expect(result.page.totalElements).toBe(1201);
    expect(loadPage).toHaveBeenCalledTimes(4);
  });

  it("stops after 64 empty-range attempts in one public batch", async () => {
    const cursor = encodeEventFeedCursor({
      anchor: now.toISOString(),
      category: null,
      keyword: null,
      venueId: null,
      scope: "unbounded",
      horizonEnd: "2035-12-22T00:00:00.000Z",
      totalElements: 1201,
      size: 50,
      page: 0,
      ranges: [{
        start: now.toISOString(),
        end: "2026-08-01T00:00:00.000Z",
      }],
    }, "test-key");
    const loadPage = vi.fn<TicketmasterPageLoader>(async () => pageResult([], 0, 0, 0));

    await expect(fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      cursor,
      loadPage,
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(loadPage).toHaveBeenCalledTimes(64);
  });

  it("returns a null continuation after the final finite range", async () => {
    const cursor = encodeEventFeedCursor({
      anchor: now.toISOString(),
      category: null,
      keyword: null,
      venueId: null,
      scope: "unbounded",
      horizonEnd: "2026-08-01T00:00:00.000Z",
      totalElements: 1201,
      size: 50,
      page: 0,
      ranges: [{
        start: now.toISOString(),
        end: "2026-08-01T00:00:00.000Z",
      }],
    }, "test-key");
    const loadPage = vi.fn<TicketmasterPageLoader>(async () =>
      pageResult([event("final")], 0, 1, 1),
    );

    const result = await fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      cursor,
      loadPage,
    });

    expect(result.events.map(({ id }) => id)).toEqual(["final"]);
    expect(result.nextCursor).toBeNull();
  });

  it("binds every continuation to keyword, venue, and category", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async () =>
      pageResult([event("one")], 0, 81, 2),
    );
    const first = await fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      keyword: "Taylor Swift",
      venueId: "venue-1",
      category: "markets",
      loadPage,
    });

    expect(loadPage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      keyword: "Taylor Swift",
      venueId: "venue-1",
      category: "markets",
      sort: "date,asc",
    }));
    for (const changed of [
      { keyword: "Different", venueId: "venue-1", category: "markets" as const },
      { keyword: "Taylor Swift", venueId: "venue-2", category: "markets" as const },
      { keyword: "Taylor Swift", venueId: "venue-1", category: "concerts" as const },
    ]) {
      await expect(fetchAucklandEventFeed({
        apiKey: "test-key",
        now,
        ...changed,
        cursor: first.nextCursor ?? "",
        loadPage,
      })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    }
    expect(loadPage).toHaveBeenCalledTimes(1);
  });

  it("fails safely when an oversized feed has no valid farthest event", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async (options) =>
      options.sort === "date,desc"
        ? pageResult([], 0, 1201, 25)
        : pageResult([], 0, 1201, 25),
    );

    await expect(fetchAucklandEventFeed({
      apiKey: "test-key",
      now,
      loadPage,
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(loadPage).toHaveBeenCalledTimes(2);
  });
});
