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
    title: "Markets around Auckland",
    intro: "Night markets, farmers markets and Sunday markets, with the next date each one usually runs.",
    loading: "Loading markets",
    count: (shown: number, total: number) => `${shown} of ${total} markets`,
    more: (count: number) => `Show ${count} more market${count === 1 ? "" : "s"}`,
    empty: "No markets match these filters",
    error: "Market schedules are temporarily unavailable",
    errorBody: "The events above still work. Try loading markets again.",
    retry: "Try again",
    source: "Usual schedule · check with the market before you go",
  },
  zh: {
    eyebrow: "奥克兰市集",
    title: "奥克兰各区市集",
    intro: "夜市、农夫市集和周日市集，按惯例显示下一次开市时间。",
    loading: "正在加载市集",
    count: (shown: number, total: number) => `${shown} / ${total} 个市集`,
    more: (count: number) => `展开另外 ${count} 个市集`,
    empty: "没有符合筛选条件的市集",
    error: "市集日程暂时不可用",
    errorBody: "上面的活动不受影响，可以重新加载市集。",
    retry: "重试",
    source: "惯例日程 · 出发前请向市集确认",
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
