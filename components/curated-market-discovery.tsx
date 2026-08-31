"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EventCard } from "../app/events/event-card";
import type { EventCategory } from "../lib/event-categories";
import type { EventSort } from "../lib/event-search-params";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";
import type { EventWindow } from "../lib/event-window";
import { useLanguage } from "./language-provider";

type RequestMarketsOptions = {
  window?: EventWindow;
  keyword?: string;
  venueId?: string;
};

type RequestMarkets = (options: RequestMarketsOptions) => Promise<AucklandEventsResult>;
type MarketState =
  | { status: "loading"; requestKey: string }
  | { status: "ready"; requestKey: string; events: KiwiCueEvent[]; total: number }
  | { status: "empty"; requestKey: string }
  | { status: "error"; requestKey: string };

type CuratedMarketDiscoveryProps = {
  window?: EventWindow;
  category?: EventCategory | null;
  keyword?: string | null;
  venueId?: string | null;
  sort?: EventSort;
  requestMarkets?: RequestMarkets;
};

const copy = {
  en: {
    eyebrow: "Auckland markets",
    title: "Neighbourhood markets, alongside the main feed",
    intro: "Recurring schedules are checked separately from Ticketmaster, so useful local stops do not disappear when the main feed is quiet.",
    loading: "Checking organiser schedules",
    count: (shown: number, total: number) => `${shown} of ${total} organiser schedules`,
    more: (count: number) => `Show ${count} more market${count === 1 ? "" : "s"}`,
    empty: "No organiser schedules match these filters",
    error: "Market schedules are temporarily unavailable",
    errorBody: "The Ticketmaster feed can still be used above. Try the organiser schedules again.",
    retry: "Retry market schedules",
    source: "Organiser schedule reference · next occurrence is expected, not guaranteed",
  },
  zh: {
    eyebrow: "奥克兰市集",
    title: "社区市集，和主活动源分开显示",
    intro: "周期日程独立核对 Ticketmaster；即使主活动源暂时没有结果，也不会把有用的本地市集藏起来。",
    loading: "正在核对主办方日程",
    count: (shown: number, total: number) => `已显示 ${shown} 个，共 ${total} 条主办方日程`,
    more: (count: number) => `展开另外 ${count} 个市集`,
    empty: "没有符合这些筛选条件的主办方日程",
    error: "市集日程暂时不可用",
    errorBody: "上方 Ticketmaster 活动仍可使用；可以重新尝试市集日程。",
    retry: "重新加载市集日程",
    source: "主办方日程参考 · 下次发生时间是预计，不是保证",
  },
} as const;

async function requestMarketsFromApi(options: RequestMarketsOptions): Promise<AucklandEventsResult> {
  const params = new URLSearchParams({ size: "50", category: "markets" });
  if (options.window && options.window !== "all") params.set("window", options.window);
  if (options.keyword) params.set("q", options.keyword);
  if (options.venueId) params.set("venue", options.venueId);
  const response = await fetch(`/api/events?${params.toString()}`, { headers: { accept: "application/json" } });
  const body = await response.json() as AucklandEventsResult | { error?: unknown };
  if (!response.ok || !("events" in body) || !Array.isArray(body.events)) throw new Error("Market feed unavailable");
  return body;
}

function requestOptions(window: EventWindow, keyword: string | null, venueId: string | null): RequestMarketsOptions {
  return {
    ...(window !== "all" ? { window } : {}),
    ...(keyword ? { keyword } : {}),
    ...(venueId ? { venueId } : {}),
  };
}

function MarketPreview({ state, language }: { state: Extract<MarketState, { status: "ready" }>; language: "en" | "zh" }): ReactNode {
  const content = copy[language];
  const preview = state.events.slice(0, 3);
  const remaining = state.events.slice(3);
  return <section className="curated-market-discovery" aria-labelledby="curated-market-title">
    <header><p className="eyebrow">{content.eyebrow}</p><h2 id="curated-market-title">{content.title}</h2><p>{content.intro}</p></header>
    <div className="curated-market-toolbar"><span>{content.count(preview.length, state.total)}</span><span>{content.source}</span></div>
    <MarketCards events={preview} offset={0} language={language} />
    {remaining.length > 0 ? <details className="curated-market-more"><summary>{content.more(remaining.length)}</summary><MarketCards events={remaining} offset={preview.length} language={language} /></details> : null}
  </section>;
}

function MarketCards({ events, offset, language }: { events: KiwiCueEvent[]; offset: number; language: "en" | "zh" }): ReactNode {
  return <ol className="curated-market-grid">
    {events.map((event, index) => <li key={event.id}><EventCard event={event} index={index + offset} language={language} variant="row" /></li>)}
  </ol>;
}

function MarketStateView({ current, content, language, retry }: { current: MarketState; content: (typeof copy)["en"] | (typeof copy)["zh"]; language: "en" | "zh"; retry: () => void }): ReactNode {
  if (current.status === "loading") return <section className="curated-market-discovery" aria-busy="true" aria-live="polite"><p className="eyebrow">{content.eyebrow}</p><h2>{content.title}</h2><p>{content.loading}</p></section>;
  if (current.status === "error") return <section className="curated-market-discovery" role="alert"><p className="eyebrow">{content.eyebrow}</p><h2>{content.error}</h2><p>{content.errorBody}</p><button type="button" onClick={retry}>{content.retry}</button></section>;
  if (current.status === "empty") return <section className="curated-market-discovery" aria-live="polite"><p className="eyebrow">{content.eyebrow}</p><h2>{content.title}</h2><p>{content.empty}</p></section>;
  return <MarketPreview state={current} language={language} />;
}

export function CuratedMarketDiscovery({
  window = "all", category = null, keyword = null, venueId = null,
  requestMarkets = requestMarketsFromApi,
}: CuratedMarketDiscoveryProps) {
  const { language } = useLanguage();
  const content = copy[language];
  const [attempt, setAttempt] = useState(0);
  const requestKey = JSON.stringify({ window, keyword, venueId, attempt });
  const [state, setState] = useState<MarketState>({ status: "loading", requestKey });

  useEffect(() => {
    if (category !== null) return;
    let cancelled = false;
    const key = requestKey;
    requestMarkets(requestOptions(window, keyword, venueId)).then((result) => {
      if (cancelled) return;
      const events = result.events.filter((event) => event.category.trim().toLocaleLowerCase() === "market").filter((event, index, list) => list.findIndex((item) => item.id === event.id) === index);
      setState(events.length ? { status: "ready", requestKey: key, events, total: Math.max(result.page.totalElements, events.length) } : { status: "empty", requestKey: key });
    }).catch(() => { if (!cancelled) setState({ status: "error", requestKey: key }); });
    return () => { cancelled = true; };
  }, [category, keyword, requestKey, requestMarkets, venueId, window]);

  if (category !== null) return null;
  const current = state.requestKey === requestKey ? state : { status: "loading" as const, requestKey };
  return <MarketStateView current={current} content={content} language={language} retry={() => setAttempt((value) => value + 1)} />;
}
