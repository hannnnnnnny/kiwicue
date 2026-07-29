import "server-only";

import type { EventCategory } from "./event-categories";
import {
  decodeEventFeedCursor,
  encodeEventFeedCursor,
  type EventFeedCursorState,
  type EventTimeRange,
} from "./event-feed-cursor";
import type { AucklandEventsResult, TicketmasterPageResult } from "./events";
import {
  fetchAucklandEvents,
  TicketmasterClientError,
} from "./ticketmaster";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const MIN_SPLIT_RANGE_MS = 60 * 1000;
const MAX_PENDING_RANGES = 32;
const DEEP_PAGE_LIMIT = 1000;

export type TicketmasterPageLoaderOptions = {
  apiKey: string;
  size: number;
  page: number;
  startDateTime: Date;
  endDateTime: Date;
  category?: EventCategory | null;
};

export type TicketmasterPageLoader = (
  options: TicketmasterPageLoaderOptions,
) => Promise<TicketmasterPageResult>;

type FetchAucklandYearEventsOptions = {
  apiKey?: string;
  now?: Date;
  size?: number;
  category?: EventCategory | null;
  cursor?: string;
  loadPage?: TicketmasterPageLoader;
};

function normalizeSize(size = 50): number {
  if (!Number.isFinite(size)) return 50;
  return Math.min(50, Math.max(1, Math.trunc(size)));
}

function range(start: Date, end: Date): EventTimeRange {
  return { start: start.toISOString(), end: end.toISOString() };
}

function calendarMonthRanges(anchor: Date, yearEnd: Date): EventTimeRange[] {
  const ranges: EventTimeRange[] = [];
  let start = new Date(anchor.getTime());

  while (start.getTime() < yearEnd.getTime()) {
    const monthBoundary = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      1,
    ));
    const end = monthBoundary.getTime() < yearEnd.getTime()
      ? monthBoundary
      : new Date(yearEnd.getTime());
    ranges.push(range(start, end));
    start = end;
  }

  return ranges;
}

function safeFailure(): TicketmasterClientError {
  return new TicketmasterClientError("UPSTREAM_ERROR", 502);
}

function nextCursor(
  state: EventFeedCursorState,
  ranges: EventTimeRange[],
  page: number,
): string | null {
  if (ranges.length === 0) return null;
  return encodeEventFeedCursor({ ...state, ranges, page });
}

export async function fetchAucklandYearEvents({
  apiKey = process.env.TICKETMASTER_API_KEY ?? "",
  now = new Date(),
  size: requestedSize = 50,
  category,
  cursor,
  loadPage = fetchAucklandEvents,
}: FetchAucklandYearEventsOptions = {}): Promise<AucklandEventsResult> {
  const anchor = new Date(now.getTime());
  const yearEnd = new Date(anchor.getTime() + YEAR_MS);
  const decoded = cursor ? decodeEventFeedCursor(cursor, anchor) : null;
  if (cursor && !decoded) throw safeFailure();

  const state: EventFeedCursorState = decoded ?? {
    anchor: anchor.toISOString(),
    totalElements: 0,
    size: normalizeSize(requestedSize),
    page: 0,
    ranges: [range(anchor, yearEnd)],
  };
  let ranges = state.ranges.map((item) => ({ ...item }));
  let page = state.page;
  let totalElements = state.totalElements;
  let probingFullYear = !decoded;

  for (let attempts = 0; attempts < 64; attempts += 1) {
    const current = ranges[0];
    if (!current) {
      return {
        events: [],
        page: {
          size: state.size,
          totalElements,
          totalPages: Math.ceil(totalElements / state.size),
          number: 0,
        },
        nextCursor: null,
      };
    }

    const startDateTime = new Date(current.start);
    const endDateTime = new Date(current.end);
    const pageResult = await loadPage({
      apiKey,
      size: state.size,
      page,
      startDateTime,
      endDateTime,
      ...(category ? { category } : {}),
    });

    if (probingFullYear) {
      totalElements = pageResult.page.totalElements;
      probingFullYear = false;
      if (totalElements > DEEP_PAGE_LIMIT) {
        ranges = calendarMonthRanges(anchor, yearEnd);
        page = 0;
        continue;
      }
    } else if (page === 0 && pageResult.page.totalElements > DEEP_PAGE_LIMIT) {
      const duration = endDateTime.getTime() - startDateTime.getTime();
      if (duration <= MIN_SPLIT_RANGE_MS || ranges.length >= MAX_PENDING_RANGES) {
        throw safeFailure();
      }
      const midpoint = new Date(startDateTime.getTime() + Math.floor(duration / 2));
      ranges.splice(
        0,
        1,
        range(startDateTime, midpoint),
        range(midpoint, endDateTime),
      );
      page = 0;
      continue;
    }

    const nextPage = page + 1;
    const hasNextPage =
      nextPage < pageResult.page.totalPages &&
      state.size * nextPage < DEEP_PAGE_LIMIT;
    const followingRanges = hasNextPage ? ranges : ranges.slice(1);
    const followingPage = hasNextPage ? nextPage : 0;
    const continuation = nextCursor(
      { ...state, totalElements },
      followingRanges,
      followingPage,
    );

    if (pageResult.events.length === 0 && continuation) {
      ranges = followingRanges;
      page = followingPage;
      continue;
    }

    return {
      events: pageResult.events,
      page: {
        size: state.size,
        totalElements,
        totalPages: Math.ceil(totalElements / state.size),
        number: pageResult.page.number,
      },
      nextCursor: continuation,
    };
  }

  throw safeFailure();
}
