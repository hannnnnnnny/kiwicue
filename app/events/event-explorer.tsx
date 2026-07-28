"use client";

import { useEffect, useState } from "react";
import { useLanguage, type Language } from "../../components/language-provider";
import type { EventCategory } from "../../lib/event-categories";
import type { AucklandEventsResult, KiwiCueEvent } from "../../lib/events";

type ExplorerState =
  | { status: "loading"; events: [] }
  | { status: "ready"; events: KiwiCueEvent[] }
  | { status: "empty"; events: [] }
  | { status: "error"; events: [] };

async function requestEventsFromApi(category?: EventCategory): Promise<AucklandEventsResult> {
  const params = new URLSearchParams({ size: "24" });
  if (category) params.set("category", category);

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
    count: (count: number) => `${count} ${count === 1 ? "event" : "events"} found · Soonest first`,
    sources: "Official source links included",
    venuePending: "Auckland venue to be confirmed",
    linkLabel: (name: string) => `View ${name} on Ticketmaster`,
    linkText: "Official details",
    disclaimer: "Event details and ticket availability come from Ticketmaster. KiwiCue helps you discover events and does not sell tickets.",
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
    count: (count: number) => `找到 ${count} 个活动 · 最早发生优先`,
    sources: "包含官方来源链接",
    venuePending: "奥克兰场馆待确认",
    linkLabel: (name: string) => `在 Ticketmaster 查看 ${name}`,
    linkText: "官方详情",
    disclaimer: "活动详情和余票状态来自 Ticketmaster。KiwiCue 帮你发现活动，不销售门票。",
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

export function EventExplorer({
  category = null,
  requestEvents = requestEventsFromApi,
}: {
  category?: EventCategory | null;
  requestEvents?: (category?: EventCategory) => Promise<AucklandEventsResult>;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [state, setState] = useState<ExplorerState>({ status: "loading", events: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    requestEvents(category ?? undefined)
      .then((result) => {
        if (cancelled) return;
        setState(result.events.length
          ? { status: "ready", events: result.events }
          : { status: "empty", events: [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", events: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, requestEvents, category]);

  function retry() {
    setState({ status: "loading", events: [] });
    setAttempt((currentAttempt) => currentAttempt + 1);
  }

  if (state.status === "loading") {
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

  if (state.status === "ready") {
    return (
      <section className="event-feed" aria-live="polite">
        <div className="event-feed-toolbar">
          <p>{content.count(state.events.length)}</p>
          <span><i aria-hidden="true" /> {content.sources}</span>
        </div>
        <ol className="event-list">
          {state.events.map((event, index) => (
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
        <p className="source-disclaimer">
          {content.disclaimer}
        </p>
      </section>
    );
  }

  if (state.status === "empty") {
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

  if (state.status === "error") {
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
