"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../components/language-provider";
import type { EventCategory } from "../../lib/event-categories";
import type { AucklandEventsResult, KiwiCueEvent } from "../../lib/events";
import type { EventWindow } from "../../lib/event-window";
import { EventCard } from "./event-card";

type RequestEventsOptions = {
  window?: EventWindow;
  category?: EventCategory;
  keyword?: string;
  venueId?: string;
  cursor?: string;
};

type RequestEvents = (options: RequestEventsOptions) => Promise<AucklandEventsResult>;

type ReadyState = {
  status: "ready";
  requestKey: string;
  events: KiwiCueEvent[];
  totalElements: number;
  nextCursor: string | null;
  appendStatus: "idle" | "loading" | "error";
};

type ExplorerState =
  | { status: "loading"; events: [] }
  | ReadyState
  | { status: "empty"; requestKey: string; events: [] }
  | { status: "error"; requestKey: string; events: [] };

async function requestEventsFromApi({
  window,
  category,
  keyword,
  venueId,
  cursor,
}: RequestEventsOptions): Promise<AucklandEventsResult> {
  const params = new URLSearchParams({ size: "50" });
  if (window && window !== "all") params.set("window", window);
  if (category) params.set("category", category);
  if (keyword) params.set("q", keyword);
  if (venueId) params.set("venue", venueId);
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/events?${params.toString()}`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json() as AucklandEventsResult | { error?: { message?: string } };

  if (!response.ok || !("events" in body) || !Array.isArray(body.events)) {
    throw new Error("Event feed unavailable");
  }

  return body;
}

const copy = {
  en: {
    loading: "Scanning Auckland for what is next",
    count: (isFiltered: boolean, total: number, shown: number) => `${total} ${isFiltered ? "matching" : "upcoming"} Ticketmaster ${total === 1 ? "event" : "events"} · ${shown} shown`,
    sources: "Official source links included",
    disclaimer: "Event details and ticket availability come from Ticketmaster. KiwiCue helps you discover events and does not sell tickets.",
    more: (count: number) => `Show ${count} more ${count === 1 ? "event" : "events"}`,
    loadingMore: "Loading more events",
    appendError: "Loading more events failed. Your shown events are still here.",
    retryMore: "Retry loading more events",
    complete: "All Ticketmaster events are shown",
    emptyCode: "AKL / 00",
    upcomingEmptyTitle: "No upcoming events found",
    upcomingEmptyBody: "Check back soon—new Auckland events are added throughout the week.",
    matchingEmptyTitle: "No matching events found",
    matchingEmptyBody: "Try changing or clearing your filters.",
    emptyAction: "Clear all filters",
    errorCode: "SIGNAL LOST",
    errorTitle: "Auckland events are temporarily out of range",
    errorBody: "We could not refresh the event feed. Your Ticketmaster key and technical details remain private.",
    retryLabel: "Retry event scan",
    retryText: "Scan again",
  },
  zh: {
    loading: "正在扫描奥克兰近期活动",
    count: (isFiltered: boolean, total: number, shown: number) => isFiltered
      ? `Ticketmaster 共找到 ${total} 个匹配活动 · 已显示 ${shown} 个`
      : `Ticketmaster 当前可查 ${total} 个未来活动 · 已显示 ${shown} 个`,
    sources: "包含官方来源链接",
    disclaimer: "活动详情和余票状态来自 Ticketmaster。KiwiCue 帮你发现活动，不销售门票。",
    more: (count: number) => `再显示 ${count} 个活动`,
    loadingMore: "正在加载更多活动",
    appendError: "加载更多活动失败，已显示的活动仍会保留。",
    retryMore: "重新加载更多活动",
    complete: "Ticketmaster 活动已全部显示",
    emptyCode: "奥克兰 / 00",
    upcomingEmptyTitle: "暂时没有未来活动",
    upcomingEmptyBody: "请稍后再来，本周还会陆续加入新的奥克兰活动。",
    matchingEmptyTitle: "没有找到匹配的活动",
    matchingEmptyBody: "请更改或清除筛选条件后再试。",
    emptyAction: "清除全部筛选",
    errorCode: "信号暂时中断",
    errorTitle: "暂时无法获取奥克兰活动",
    errorBody: "活动信息刷新失败。你的 Ticketmaster 密钥和技术详情仍然保密。",
    retryLabel: "重新扫描活动",
    retryText: "重新扫描",
  },
} as const;

function appendUniqueEvents(current: KiwiCueEvent[], incoming: KiwiCueEvent[]): KiwiCueEvent[] {
  const seen = new Set(current.map((event) => event.id));
  const uniqueIncoming = incoming.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
  return [...current, ...uniqueIncoming];
}

function buildRequestOptions(
  window: EventWindow,
  category: EventCategory | null,
  keyword: string | null,
  venueId: string | null,
  cursor?: string,
): RequestEventsOptions {
  const options: RequestEventsOptions = {};
  if (window !== "all") options.window = window;
  if (category) options.category = category;
  if (keyword) options.keyword = keyword;
  if (venueId) options.venueId = venueId;
  if (cursor) options.cursor = cursor;
  return options;
}

export function EventExplorer({
  window = "all",
  category = null,
  keyword = null,
  venueId = null,
  requestEvents = requestEventsFromApi,
}: {
  window?: EventWindow;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  requestEvents?: RequestEvents;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [state, setState] = useState<ExplorerState>({ status: "loading", events: [] });
  const [attempt, setAttempt] = useState(0);
  const generationRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const resultsSummaryRef = useRef<HTMLParagraphElement>(null);
  const requestKey = JSON.stringify({
    category: category ?? null,
    window,
    keyword: keyword ?? null,
    venueId: venueId ?? null,
    attempt,
  });
  const isFiltered = Boolean(keyword || venueId || category || window !== "all");
  const stateForRequest: ExplorerState = state.status !== "loading" && state.requestKey === requestKey
    ? state
    : { status: "loading", events: [] };

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;
    appendInFlightRef.current = false;

    const options = buildRequestOptions(window, category, keyword, venueId);
    requestEvents(options)
      .then((result) => {
        if (cancelled || generation !== generationRef.current) return;
        setState(result.events.length
          ? {
              status: "ready",
              requestKey,
              events: result.events,
              totalElements: Math.max(result.page.totalElements, result.events.length),
              nextCursor: result.nextCursor,
              appendStatus: "idle",
            }
          : { status: "empty", requestKey, events: [] });
      })
      .catch(() => {
        if (!cancelled && generation === generationRef.current) {
          setState({ status: "error", requestKey, events: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, requestEvents, window, category, keyword, venueId]);

  useEffect(() => {
    if (stateForRequest.status !== "ready") return;
    if (sessionStorage.getItem("kiwicue:focus-results") !== "1") return;
    sessionStorage.removeItem("kiwicue:focus-results");
    resultsSummaryRef.current?.focus();
  }, [requestKey, stateForRequest.status]);

  function retry() {
    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  async function loadMore() {
    if (
      state.status !== "ready"
      || !state.nextCursor
      || state.appendStatus === "loading"
      || appendInFlightRef.current
    ) return;

    const cursor = state.nextCursor;
    const generation = generationRef.current;
    appendInFlightRef.current = true;
    setState((current) => current.status === "ready" && current.requestKey === requestKey && current.nextCursor === cursor
      ? { ...current, appendStatus: "loading" }
      : current);

    try {
      const options = buildRequestOptions(window, category, keyword, venueId, cursor);
      const result = await requestEvents(options);
      if (generation !== generationRef.current) return;

      setState((current) => {
        if (current.status !== "ready" || current.requestKey !== requestKey || current.nextCursor !== cursor) return current;
        const events = appendUniqueEvents(current.events, result.events);
        return {
          status: "ready",
          requestKey,
          events,
          totalElements: Math.max(current.totalElements, result.page.totalElements, events.length),
          nextCursor: result.nextCursor,
          appendStatus: "idle",
        };
      });
    } catch {
      if (generation !== generationRef.current) return;
      setState((current) => current.status === "ready" && current.requestKey === requestKey && current.nextCursor === cursor
        ? { ...current, appendStatus: "error" }
        : current);
    } finally {
      if (generation === generationRef.current) appendInFlightRef.current = false;
    }
  }

  if (stateForRequest.status === "loading") {
    return (
      <section className="event-state event-loading" role="status" aria-busy="true">
        <span className="loading-pulse" aria-hidden="true" />
        <p>{content.loading}</p>
        <div className="event-grid-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <i key={index}><span /><span /><span /></i>
          ))}
        </div>
      </section>
    );
  }

  if (stateForRequest.status === "ready") {
    const remaining = Math.max(stateForRequest.totalElements - stateForRequest.events.length, 0);
    const moreCount = Math.min(50, Math.max(remaining, 1));

    return (
      <section className="event-feed" aria-live="polite">
        <div className="event-feed-toolbar">
          <p id="event-results-summary" ref={resultsSummaryRef} tabIndex={-1}>
            {content.count(isFiltered, stateForRequest.totalElements, stateForRequest.events.length)}
          </p>
          <span><i aria-hidden="true" /> {content.sources}</span>
        </div>
        <ol className="event-grid">
          {stateForRequest.events.map((event, index) => (
            <li key={event.id}>
              <EventCard event={event} index={index} language={language} />
            </li>
          ))}
        </ol>

        {stateForRequest.nextCursor ? (
          <div className="event-load-more-wrap" aria-busy={stateForRequest.appendStatus === "loading"}>
            {stateForRequest.appendStatus === "error" && (
              <p className="event-load-more-error" role="alert">{content.appendError}</p>
            )}
            <button
              className="event-load-more"
              type="button"
              onClick={loadMore}
              disabled={stateForRequest.appendStatus === "loading"}
            >
              {stateForRequest.appendStatus === "loading"
                ? content.loadingMore
                : stateForRequest.appendStatus === "error"
                  ? content.retryMore
                  : content.more(moreCount)}
            </button>
          </div>
        ) : (
          <p className="event-feed-complete" role="status">{content.complete}</p>
        )}

        <p className="source-disclaimer">
          {content.disclaimer}
        </p>
      </section>
    );
  }

  if (stateForRequest.status === "empty") {
    return (
      <section className="event-state event-empty" aria-live="polite">
        <span className="state-code" aria-hidden="true">{content.emptyCode}</span>
        <h2>{isFiltered ? content.matchingEmptyTitle : content.upcomingEmptyTitle}</h2>
        <p>{isFiltered ? content.matchingEmptyBody : content.upcomingEmptyBody}</p>
        {isFiltered && (
          <Link className="portal-empty-action" href="/events">{content.emptyAction}</Link>
        )}
      </section>
    );
  }

  if (stateForRequest.status === "error") {
    return (
      <section className="event-state event-error" role="alert">
        <span className="state-code" aria-hidden="true">{content.errorCode}</span>
        <h2>{content.errorTitle}</h2>
        <p>{content.errorBody}</p>
        <button type="button" onClick={retry} aria-label={content.retryLabel}>
          {content.retryText} <span aria-hidden="true">↻</span>
        </button>
      </section>
    );
  }

  return null;
}
