"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage, type Language } from "../../components/language-provider";
import type { EventCategory } from "../../lib/event-categories";
import type { AucklandEventsResult, KiwiCueEvent } from "../../lib/events";

type RequestEventsOptions = {
  category?: EventCategory;
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
  category,
  cursor,
}: RequestEventsOptions): Promise<AucklandEventsResult> {
  const params = new URLSearchParams({ size: "50" });
  if (category) params.set("category", category);
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
    timePending: "Time to be confirmed",
    count: (total: number, shown: number) => `${total} Ticketmaster ${total === 1 ? "event" : "events"} in the next year · ${shown} shown`,
    sources: "Official source links included",
    venuePending: "Auckland venue to be confirmed",
    linkLabel: (name: string) => `View ${name} on Ticketmaster`,
    linkText: "Official details",
    disclaimer: "Event details and ticket availability come from Ticketmaster. KiwiCue helps you discover events and does not sell tickets.",
    more: (count: number) => `Show ${count} more ${count === 1 ? "event" : "events"}`,
    loadingMore: "Loading more events",
    appendError: "Loading more events failed. Your shown events are still here.",
    retryMore: "Retry loading more events",
    complete: "All Ticketmaster events are shown",
    emptyCode: "AKL / 00",
    emptyTitle: "Nothing on our radar yet",
    emptyBody: "Try again soon—new Auckland events are added throughout the week.",
    errorCode: "SIGNAL LOST",
    errorTitle: "Auckland events are temporarily out of range",
    errorBody: "We could not refresh the event feed. Your Ticketmaster key and technical details remain private.",
    retryLabel: "Retry event scan",
    retryText: "Scan again",
  },
  zh: {
    loading: "正在扫描奥克兰近期活动",
    timePending: "时间待定",
    count: (total: number, shown: number) => `未来一年 Ticketmaster 共 ${total} 个活动 · 已显示 ${shown} 个`,
    sources: "包含官方来源链接",
    venuePending: "奥克兰场馆待确认",
    linkLabel: (name: string) => `在 Ticketmaster 查看 ${name}`,
    linkText: "官方详情",
    disclaimer: "活动详情和余票状态来自 Ticketmaster。KiwiCue 帮你发现活动，不销售门票。",
    more: (count: number) => `再显示 ${count} 个活动`,
    loadingMore: "正在加载更多活动",
    appendError: "加载更多活动失败，已显示的活动仍会保留。",
    retryMore: "重新加载更多活动",
    complete: "Ticketmaster 活动已全部显示",
    emptyCode: "奥克兰 / 00",
    emptyTitle: "雷达上暂时没有活动",
    emptyBody: "请稍后再来，本周还会陆续加入新的奥克兰活动。",
    errorCode: "信号暂时中断",
    errorTitle: "暂时无法获取奥克兰活动",
    errorBody: "活动信息刷新失败。你的 Ticketmaster 密钥和技术详情仍然保密。",
    retryLabel: "重新扫描活动",
    retryText: "重新扫描",
  },
} as const;

const categoryNames = {
  en: { concerts: "concerts", theatre: "theatre events", markets: "markets", festivals: "festivals" },
  zh: { concerts: "演唱会", theatre: "话剧演出", markets: "市集", festivals: "节日活动" },
} as const;

function formatEventDate(localDate: string, language: Language): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (language === "zh") {
    const weekday = new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
    return `${month}月${day}日${weekday}`;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatEventTime(localTime: string | null, language: Language): string {
  if (!localTime) return copy[language].timePending;
  const [hour, minute] = localTime.split(":").map(Number);
  if (language === "zh") {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute))).toLowerCase();
}

function appendUniqueEvents(current: KiwiCueEvent[], incoming: KiwiCueEvent[]): KiwiCueEvent[] {
  const seen = new Set(current.map((event) => event.id));
  const uniqueIncoming = incoming.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
  return [...current, ...uniqueIncoming];
}

export function EventExplorer({
  category = null,
  requestEvents = requestEventsFromApi,
}: {
  category?: EventCategory | null;
  requestEvents?: RequestEvents;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [state, setState] = useState<ExplorerState>({ status: "loading", events: [] });
  const [attempt, setAttempt] = useState(0);
  const generationRef = useRef(0);
  const appendInFlightRef = useRef(false);
  const requestKey = `${category ?? "all"}:${attempt}`;
  const stateForRequest: ExplorerState = state.status !== "loading" && state.requestKey === requestKey
    ? state
    : { status: "loading", events: [] };

  useEffect(() => {
    const generation = ++generationRef.current;
    let cancelled = false;
    appendInFlightRef.current = false;

    const options: RequestEventsOptions = category ? { category } : {};
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
  }, [requestKey, requestEvents, category]);

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
      const options: RequestEventsOptions = category
        ? { category, cursor }
        : { cursor };
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
        <div className="event-skeletons" aria-hidden="true">
          <i /><i /><i />
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
          <p>{content.count(stateForRequest.totalElements, stateForRequest.events.length)}</p>
          <span><i aria-hidden="true" /> {content.sources}</span>
        </div>
        <ol className="event-list">
          {stateForRequest.events.map((event, index) => (
            <li key={event.id}>
              <article className="event-card">
                <div className="event-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                <div className="event-date-block">
                  <time dateTime={event.start.localDate}>{formatEventDate(event.start.localDate, language)}</time>
                  <span>{formatEventTime(event.start.localTime, language)}</span>
                </div>
                <div className="event-card-copy">
                  <div className="event-labels">
                    <span>{event.category}</span>
                    {event.status !== "onsale" && <span>{event.status.replaceAll("_", " ")}</span>}
                  </div>
                  <h3>{event.name}</h3>
                  <p className="event-venue">
                    {event.venue ? `${event.venue.name} · ${event.venue.city}` : content.venuePending}
                  </p>
                  {event.venue?.address && <p className="event-address">{event.venue.address}</p>}
                  <a
                    className="event-source-link"
                    href={event.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={content.linkLabel(event.name)}
                  >
                    {content.linkText} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div
                  className={`event-art${event.imageUrl ? " has-image" : ""}`}
                  style={event.imageUrl
                    ? { backgroundImage: `linear-gradient(135deg, transparent, rgba(8, 10, 8, .55)), url(${JSON.stringify(event.imageUrl)})` }
                    : undefined}
                  aria-hidden="true"
                >
                  {!event.imageUrl && <span>AKL</span>}
                </div>
              </article>
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
    const emptyTitle = category
      ? language === "en"
        ? `No ${categoryNames.en[category]} on our radar yet`
        : `暂时没有找到${categoryNames.zh[category]}`
      : content.emptyTitle;

    return (
      <section className="event-state event-empty" aria-live="polite">
        <span className="state-code" aria-hidden="true">{content.emptyCode}</span>
        <h2>{emptyTitle}</h2>
        <p>{content.emptyBody}</p>
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
