import "server-only";

import type { EventCategory } from "./event-categories";
import {
  decodeEventFeedCursor,
  encodeEventFeedCursor,
  type EventFeedCursorState,
  type EventTimeRange,
} from "./event-feed-cursor";
import { parseEventKeyword, parseVenueId } from "./event-search-params";
import type { AucklandEventsResult, TicketmasterPageResult } from "./events";
import {
  fetchAucklandEvents,
  TicketmasterClientError,
  type TicketmasterSort,
} from "./ticketmaster";

const MIN_SPLIT_RANGE_MS = 60 * 1000;
const MAX_PENDING_RANGES = 32;
const DEEP_PAGE_LIMIT = 1000;
const FARTHEST_EVENT_PADDING_MS = 48 * 60 * 60 * 1000;

export type TicketmasterPageLoaderOptions = {
  apiKey: string;
  size: number;
  page: number;
  startDateTime: Date;
  endDateTime?: Date;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  sort?: TicketmasterSort;
};

export type TicketmasterPageLoader = (
  options: TicketmasterPageLoaderOptions,
) => Promise<TicketmasterPageResult>;

type FetchAucklandEventFeedOptions = {
  apiKey?: string;
  now?: Date;
  size?: number;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
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

function nextCalendarRange(start: Date, horizon: Date): EventTimeRange {
  const monthBoundary = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth() + 1,
    1,
  ));
  const end = monthBoundary.getTime() < horizon.getTime()
    ? monthBoundary
    : new Date(horizon.getTime());
  return range(start, end);
}

function safeFailure(): TicketmasterClientError {
  return new TicketmasterClientError("UPSTREAM_ERROR", 502);
}

function filters(state: EventFeedCursorState): Partial<TicketmasterPageLoaderOptions> {
  return {
    ...(state.category ? { category: state.category } : {}),
    ...(state.keyword ? { keyword: state.keyword } : {}),
    ...(state.venueId ? { venueId: state.venueId } : {}),
  };
}

function nextCursor(
  state: EventFeedCursorState,
  ranges: EventTimeRange[],
  page: number,
  secret: string,
): string | null {
  if (ranges.length === 0) return null;
  return encodeEventFeedCursor({ ...state, ranges, page }, secret);
}

function rangesAfterCompletedRange(
  ranges: EventTimeRange[],
  horizonEnd: string | null,
): EventTimeRange[] {
  const following = ranges.slice(1);
  if (following.length > 0 || !horizonEnd || !ranges[0]?.end) return following;

  const completedEnd = new Date(ranges[0].end);
  const horizon = new Date(horizonEnd);
  return completedEnd.getTime() < horizon.getTime()
    ? [nextCalendarRange(completedEnd, horizon)]
    : [];
}

export async function fetchAucklandEventFeed({
  apiKey = process.env.TICKETMASTER_API_KEY ?? "",
  now = new Date(),
  size: requestedSize = 50,
  category,
  keyword,
  venueId,
  cursor,
  loadPage = fetchAucklandEvents,
}: FetchAucklandEventFeedOptions = {}): Promise<AucklandEventsResult> {
  const anchor = new Date(now.getTime());
  const requestedCategory = category ?? null;
  const requestedKeyword = parseEventKeyword(keyword) ?? null;
  const requestedVenueId = parseVenueId(venueId) ?? null;
  const decoded = cursor ? decodeEventFeedCursor(cursor, apiKey, anchor) : null;
  if (cursor && !decoded) throw safeFailure();
  if (
    decoded &&
    (
      decoded.category !== requestedCategory ||
      decoded.keyword !== requestedKeyword ||
      decoded.venueId !== requestedVenueId ||
      decoded.scope !== "unbounded"
    )
  ) throw safeFailure();

  const state: EventFeedCursorState = decoded ?? {
    anchor: anchor.toISOString(),
    category: requestedCategory,
    keyword: requestedKeyword,
    venueId: requestedVenueId,
    scope: "unbounded",
    horizonEnd: null,
    totalElements: 0,
    size: normalizeSize(requestedSize),
    page: 0,
    ranges: [{ start: anchor.toISOString(), end: null }],
  };
  const feedAnchor = new Date(state.anchor);
  let ranges = state.ranges.map((item) => ({ ...item }));
  let page = state.page;
  let totalElements = state.totalElements;
  let horizonEnd = state.horizonEnd;
  let probingUnbounded = !decoded;

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
    const endDateTime = current.end ? new Date(current.end) : undefined;
    const pageResult = await loadPage({
      apiKey,
      size: state.size,
      page,
      startDateTime,
      endDateTime,
      sort: "date,asc",
      ...filters(state),
    });

    if (probingUnbounded) {
      totalElements = pageResult.page.totalElements;
      probingUnbounded = false;
      if (totalElements > DEEP_PAGE_LIMIT) {
        const farthest = await loadPage({
          apiKey,
          size: 1,
          page: 0,
          startDateTime: feedAnchor,
          endDateTime: undefined,
          sort: "date,desc",
          ...filters(state),
        });
        const farthestEvent = farthest.events[0];
        if (!farthestEvent) throw safeFailure();
        const farthestDate = farthestEvent.start.dateTime
          ? new Date(farthestEvent.start.dateTime)
          : new Date(`${farthestEvent.start.localDate}T00:00:00.000Z`);
        if (!Number.isFinite(farthestDate.getTime())) throw safeFailure();
        const exclusiveEnd = new Date(farthestDate.getTime() + FARTHEST_EVENT_PADDING_MS);
        if (
          !Number.isFinite(exclusiveEnd.getTime()) ||
          exclusiveEnd.getTime() <= feedAnchor.getTime()
        ) throw safeFailure();
        horizonEnd = exclusiveEnd.toISOString();
        ranges = [nextCalendarRange(feedAnchor, exclusiveEnd)];
        page = 0;
        continue;
      }
    } else if (
      endDateTime &&
      page === 0 &&
      pageResult.page.totalElements > DEEP_PAGE_LIMIT
    ) {
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
    const followingRanges = hasNextPage
      ? ranges
      : rangesAfterCompletedRange(ranges, horizonEnd);
    const followingPage = hasNextPage ? nextPage : 0;
    const continuation = nextCursor(
      { ...state, horizonEnd, totalElements },
      followingRanges,
      followingPage,
      apiKey,
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
