"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../components/language-provider";
import { EventGridSkeleton } from "../../components/event-grid-skeleton";
import { EventDiscoveryView, EventResultsView } from "../../components/event-discovery-sections";
import { EventLocalFacets } from "../../components/event-local-facets";
import type { EventCategory } from "../../lib/event-categories";
import type { EventSort } from "../../lib/event-search-params";
import { filterEligibleDiscoveryEvents } from "../../lib/event-discovery";
import { buildEventFacetOptions, filterEventFacet, type EventLocalFacet } from "../../lib/event-facets";
import type { AucklandEventsResult, KiwiCueEvent } from "../../lib/events";
import type { EventWindow } from "../../lib/event-window";

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
    feedTitle: "Happening soon",
    feedIntro: "Dates stay easy to scan, with useful detail and verified sources kept visible.",
    loading: "Scanning Auckland for what is next",
    count: (isFiltered: boolean, checked: number, shown: number) => `${shown} eligible ${isFiltered ? "matching " : ""}Ticketmaster ${shown === 1 ? "event" : "events"} shown · ${checked} source ${checked === 1 ? "record" : "records"} checked`,
    sources: "Official source links included",
    disclaimer: "Event details and ticket availability come from Ticketmaster. KiwiCue helps you discover events and does not sell tickets.",
    more: "Check for more events",
    loadingMore: "Loading more events",
    appendError: "Loading more events failed. Your shown events are still here.",
    retryMore: "Retry loading more events",
    complete: "All eligible Ticketmaster events are shown",
    marketCount: (checked: number, shown: number) => `${shown} verified market ${shown === 1 ? "schedule" : "schedules"} shown · ${checked} source ${checked === 1 ? "record" : "records"} checked`,
    marketSources: "Verified official market links",
    marketDisclaimer: "KiwiCue checks these recurring schedules against each market's official website. Confirm the latest details before travelling.",
    marketComplete: "All verified market schedules are shown",
    emptyCode: "AKL / 00",
    upcomingEmptyTitle: "No upcoming events found",
    upcomingEmptyBody: "Check back soon—new Auckland events are added throughout the week.",
    matchingEmptyTitle: "No matching events found",
    matchingEmptyBody: "Try changing or clearing your filters.",
    batchEmptyTitle: "No eligible events in this batch",
    batchEmptyBody: "Check the next source page for more Auckland events.",
    emptyAction: "Clear all filters",
    errorCode: "SIGNAL LOST",
    errorTitle: "Auckland events are temporarily out of range",
    errorBody: "We could not refresh the event feed. Your Ticketmaster key and technical details remain private.",
    retryLabel: "Retry event scan",
    retryText: "Scan again",
    localEmptyTitle: "No loaded events match this refinement",
    localEmptyBody: "Reset the refinement or load another source page to keep browsing.",
  },
  zh: {
    feedTitle: "即将发生",
    feedIntro: "日期仍然方便浏览，实用信息和可靠来源会保持可见。",
    loading: "正在扫描奥克兰近期活动",
    count: (isFiltered: boolean, checked: number, shown: number) => `已显示 ${shown} 个符合条件的${isFiltered ? "匹配" : ""} Ticketmaster 活动 · 已检查 ${checked} 条来源记录`,
    sources: "包含官方来源链接",
    disclaimer: "活动详情和余票状态来自 Ticketmaster。KiwiCue 帮你发现活动，不销售门票。",
    more: "继续检查活动",
    loadingMore: "正在加载更多活动",
    appendError: "加载更多活动失败，已显示的活动仍会保留。",
    retryMore: "重新加载更多活动",
    complete: "符合条件的 Ticketmaster 活动已全部显示",
    marketCount: (checked: number, shown: number) => `已显示 ${shown} 个核实市集日程 · 已检查 ${checked} 条来源记录`,
    marketSources: "包含已核实的市集官方链接",
    marketDisclaimer: "KiwiCue 会对照各市集官网核实定期日程；出发前请再次确认最新安排。",
    marketComplete: "已核实的市集日程已全部显示",
    emptyCode: "奥克兰 / 00",
    upcomingEmptyTitle: "暂时没有未来活动",
    upcomingEmptyBody: "请稍后再来，本周还会陆续加入新的奥克兰活动。",
    matchingEmptyTitle: "没有找到匹配的活动",
    matchingEmptyBody: "请更改或清除筛选条件后再试。",
    batchEmptyTitle: "本批没有符合条件的活动",
    batchEmptyBody: "可以继续检查下一页奥克兰活动来源。",
    emptyAction: "清除全部筛选",
    errorCode: "信号暂时中断",
    errorTitle: "暂时无法获取奥克兰活动",
    errorBody: "活动信息刷新失败。你的 Ticketmaster 密钥和技术详情仍然保密。",
    retryLabel: "重新扫描活动",
    retryText: "重新扫描",
    localEmptyTitle: "当前已加载活动不符合这个细筛条件",
    localEmptyBody: "可以重置细筛，或继续加载下一页来源记录。",
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
  sort = "recommended",
  requestEvents = requestEventsFromApi,
}: {
  window?: EventWindow;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  sort?: EventSort;
  requestEvents?: RequestEvents;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [state, setState] = useState<ExplorerState>({ status: "loading", events: [] });
  const [attempt, setAttempt] = useState(0);
  const [localFacetState, setLocalFacetState] = useState<{ requestKey: string; facet: EventLocalFacet }>({ requestKey: "", facet: "all" });
  const generationRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const resultsSummaryRef = useRef<HTMLParagraphElement>(null);
  const requestKey = JSON.stringify({
    category: category ?? null,
    window,
    keyword: keyword ?? null,
    venueId: venueId ?? null,
    sort,
    attempt,
  });
  const isFiltered = Boolean(keyword || venueId || category || window !== "all" || sort !== "recommended");
  const isMarketCategory = category === "markets";
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
        <p>{content.loading}</p>
        <EventGridSkeleton />
      </section>
    );
  }

  if (stateForRequest.status === "ready") {
    const shownEvents = filterEligibleDiscoveryEvents(stateForRequest.events, new Date());
    if (shownEvents.length === 0) {
      const canCheckMore = Boolean(stateForRequest.nextCursor);
      return (
        <section className="event-state event-empty" aria-live="polite">
          <span className="state-code" aria-hidden="true">{content.emptyCode}</span>
          <h2>{canCheckMore ? content.batchEmptyTitle : isFiltered ? content.matchingEmptyTitle : content.upcomingEmptyTitle}</h2>
          <p>{canCheckMore ? content.batchEmptyBody : isFiltered ? content.matchingEmptyBody : content.upcomingEmptyBody}</p>
          {canCheckMore && (
            <div>
              {stateForRequest.appendStatus === "error" && <p role="alert">{content.appendError}</p>}
              <button type="button" onClick={loadMore} disabled={stateForRequest.appendStatus === "loading"}>
                {stateForRequest.appendStatus === "loading"
                  ? content.loadingMore
                  : stateForRequest.appendStatus === "error" ? content.retryMore : content.more}
              </button>
            </div>
          )}
          {isFiltered && <Link className="portal-empty-action" href="/events">{content.emptyAction}</Link>}
        </section>
      );
    }
    const facetOptions = buildEventFacetOptions(shownEvents);
    const localFacet = localFacetState.requestKey === requestKey ? localFacetState.facet : "all";
    const selectedFacet = facetOptions.some((option) => option.id === localFacet) ? localFacet : "all";
    const refinedEvents = filterEventFacet(shownEvents, selectedFacet);
    const hasLocalRefinement = selectedFacet !== "all";
    return (
      <section className="event-feed" aria-live="polite">
        <header className="event-feed-heading">
          <h2>{content.feedTitle}</h2>
          <p>{content.feedIntro}</p>
        </header>
        <div className="event-feed-toolbar">
          <p id="event-results-summary" ref={resultsSummaryRef} tabIndex={-1}>
            {isMarketCategory
              ? content.marketCount(stateForRequest.events.length, refinedEvents.length)
              : content.count(isFiltered || hasLocalRefinement, stateForRequest.events.length, refinedEvents.length)}
          </p>
          <span><i aria-hidden="true" /> {isMarketCategory ? content.marketSources : content.sources}</span>
        </div>
        <EventLocalFacets
          options={facetOptions}
          value={selectedFacet}
          onChange={(facet) => setLocalFacetState({ requestKey, facet })}
        />
        {refinedEvents.length > 0 ? (
          isFiltered || hasLocalRefinement
            ? <EventResultsView events={refinedEvents} language={language} state={{ window, category, keyword, venueId, sort }} />
            : <EventDiscoveryView events={refinedEvents} language={language} />
        ) : (
          <div className="event-local-empty" role="status">
            <h3>{content.localEmptyTitle}</h3>
            <p>{content.localEmptyBody}</p>
            <button type="button" onClick={() => setLocalFacetState({ requestKey, facet: "all" })}>{content.emptyAction}</button>
          </div>
        )}

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
                  : content.more}
            </button>
          </div>
        ) : (
          <p className="event-feed-complete" role="status">
            {isMarketCategory ? content.marketComplete : content.complete}
          </p>
        )}

        <p className="source-disclaimer">
          {isMarketCategory ? content.marketDisclaimer : content.disclaimer}
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
