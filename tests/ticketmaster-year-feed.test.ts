import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decodeEventFeedCursor, encodeEventFeedCursor } from "../lib/event-feed-cursor";
import {
  fetchAucklandYearEvents,
  type TicketmasterPageLoader,
} from "../lib/ticketmaster-year-feed";
import type { KiwiCueEvent, TicketmasterPageResult } from "../lib/events";

const now = new Date("2026-07-29T00:00:00.000Z");
const yearEnd = new Date("2027-07-29T00:00:00.000Z");

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

describe("Ticketmaster year feed", () => {
  it("continues normal year pagination until its final page", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async ({ page }) =>
      page === 0
        ? pageResult([event("event-1")], 0, 81, 2)
        : pageResult([event("event-51")], 1, 81, 2),
    );

    const first = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      loadPage,
    });

    expect(first.page.totalElements).toBe(81);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(loadPage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      page: 0,
      size: 50,
      startDateTime: now,
      endDateTime: yearEnd,
    }));

    const cursor = decodeEventFeedCursor(first.nextCursor ?? "", "test-key", now);
    expect(cursor?.page).toBe(1);

    const second = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      cursor: first.nextCursor ?? "",
      loadPage,
    });

    expect(second.events).toEqual([event("event-51")]);
    expect(second.page.totalElements).toBe(81);
    expect(second.nextCursor).toBeNull();
    expect(loadPage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      page: 1,
      size: 50,
      startDateTime: now,
      endDateTime: yearEnd,
    }));
  });

  it("replaces an oversized year with adjacent calendar-month ranges", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async ({ endDateTime, page }) => {
      if (endDateTime.getTime() === yearEnd.getTime()) {
        return pageResult([], page, 1201, 25);
      }
      return pageResult([event("first-month")], page, 1, 1);
    });

    const result = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      loadPage,
    });

    expect(result.events).toEqual([event("first-month")]);
    expect(result.page.totalElements).toBe(1201);
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect(loadPage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      startDateTime: now,
      endDateTime: new Date("2026-08-01T00:00:00.000Z"),
      page: 0,
    }));
    expect(loadPage.mock.calls.every(([options]) => options.size * options.page < 1000)).toBe(true);

    const cursor = decodeEventFeedCursor(result.nextCursor ?? "", "test-key", now);
    expect(cursor?.ranges[0]).toEqual({
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-09-01T00:00:00.000Z",
    });
  });

  it("bisects an exceptional month that still exceeds the deep-page limit", async () => {
    const firstMonthEnd = new Date("2026-08-01T00:00:00.000Z");
    const loadPage = vi.fn<TicketmasterPageLoader>(async ({ startDateTime, endDateTime, page }) => {
      if (endDateTime.getTime() === yearEnd.getTime()) {
        return pageResult([], page, 1201, 25);
      }
      if (
        startDateTime.getTime() === now.getTime() &&
        endDateTime.getTime() === firstMonthEnd.getTime()
      ) {
        return pageResult([], page, 1001, 21);
      }
      return pageResult([event("split-month")], page, 1, 1);
    });

    const result = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      loadPage,
    });

    expect(result.events).toEqual([event("split-month")]);
    expect(loadPage).toHaveBeenCalledTimes(3);
    const splitCall = loadPage.mock.calls[2][0];
    expect(splitCall.startDateTime).toEqual(now);
    expect(splitCall.endDateTime.getTime()).toBeGreaterThan(now.getTime());
    expect(splitCall.endDateTime.getTime()).toBeLessThan(firstMonthEnd.getTime());
  });

  it("advances across adjacent ranges and eventually returns a null cursor", async () => {
    const cursor = encodeEventFeedCursor({
      anchor: now.toISOString(),
      category: null,
      totalElements: 2,
      size: 50,
      page: 0,
      ranges: [
        { start: now.toISOString(), end: "2026-08-01T00:00:00.000Z" },
        { start: "2026-08-01T00:00:00.000Z", end: "2026-09-01T00:00:00.000Z" },
      ],
    }, "test-key");
    const loadPage = vi.fn<TicketmasterPageLoader>(async () =>
      pageResult([event("boundary-event")], 0, 1, 1),
    );

    const first = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      cursor,
      loadPage,
    });
    const second = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      cursor: first.nextCursor ?? "",
      loadPage,
    });

    expect(first.events[0].id).toBe("boundary-event");
    expect(second.events[0].id).toBe("boundary-event");
    expect(second.nextCursor).toBeNull();
  });

  it("rejects a continuation cursor when its category changes", async () => {
    const loadPage = vi.fn<TicketmasterPageLoader>(async () =>
      pageResult([event("concert")], 0, 81, 2),
    );
    const first = await fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      category: "concerts",
      loadPage,
    });

    await expect(fetchAucklandYearEvents({
      apiKey: "test-key",
      now,
      category: "markets",
      cursor: first.nextCursor ?? "",
      loadPage,
    })).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502 });
    expect(loadPage).toHaveBeenCalledTimes(1);
  });
});
