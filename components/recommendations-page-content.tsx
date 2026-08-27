"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { buildEventRecommendations, type EventRecommendation } from "../lib/event-recommendations";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";
import { useBookmarks } from "./bookmark-provider";
import { EventGridSkeleton } from "./event-grid-skeleton";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";
import { RecommendationCard } from "./recommendation-card";

export type RecommendationFeed = "events" | "markets";
export type RecommendationFeedRequest = (
  feed: RecommendationFeed,
  signal?: AbortSignal,
) => Promise<KiwiCueEvent[]>;

type FeedState =
  | { status: "loading" }
  | { status: "ready"; events: KiwiCueEvent[]; partial: boolean }
  | { status: "error" };

const copy = {
  en: {
    eyebrow: "Auckland shortlist",
    title: "Picks for you",
    intro: "A smaller, explainable shortlist built from timing, event detail and what you save.",
    privacy: "Your saved events stay in this browser. KiwiCue never sends them to build these picks.",
    loading: "Building your Auckland shortlist",
    partial: "Some recommendations could not be refreshed.",
    partialBody: "Showing the useful picks we could verify. Try again to restore the full mix.",
    retry: "Try again",
    startTitle: "Start here",
    startBody: "The strongest mix of timing, detail and your saved preferences.",
    weekendTitle: "This weekend",
    weekendBody: "Plans that fit Auckland’s upcoming Saturday and Sunday.",
    differentTitle: "Try something different",
    differentBody: "A change of pace from the category you save most often.",
    emptyTitle: "No fresh picks yet",
    emptyBody: "There are no eligible upcoming events in the current feeds. The full finder may still have later dates.",
    browse: "Browse all events",
    errorTitle: "Recommendations are temporarily unavailable",
    errorBody: "Both event feeds are out of range. Nothing from your saved list was lost.",
    footer: "A shorter path to a good Auckland plan.",
  },
  zh: {
    eyebrow: "奥克兰精选",
    title: "为你推荐",
    intro: "根据时间、活动信息完整度和你的收藏，生成更精简、理由透明的推荐清单。",
    privacy: "收藏只保存在当前浏览器，KiwiCue 不会把收藏发送出去用于生成推荐。",
    loading: "正在生成你的奥克兰精选",
    partial: "部分推荐暂时无法刷新。",
    partialBody: "先显示目前能够核实的推荐；可以重试以恢复完整内容。",
    retry: "重试",
    startTitle: "从这里开始",
    startBody: "综合时间、信息完整度和收藏偏好的优先选择。",
    weekendTitle: "本周末",
    weekendBody: "适合奥克兰这个周六和周日的安排。",
    differentTitle: "换个口味",
    differentBody: "避开你最常收藏的类型，发现不同选择。",
    emptyTitle: "暂时没有新的推荐",
    emptyBody: "当前信息源里没有符合条件的未来活动，完整活动页可能还有更远日期。",
    browse: "浏览全部活动",
    errorTitle: "推荐暂时不可用",
    errorBody: "两个活动信息源目前都无法访问，你的收藏没有丢失。",
    footer: "更快找到合适的奥克兰安排。",
  },
} as const;

async function requestRecommendationFeed(feed: RecommendationFeed, signal?: AbortSignal) {
  const category = feed === "markets" ? "&category=markets" : "";
  const response = await fetch(`/api/events?window=30d&size=50${category}`, {
    headers: { accept: "application/json" },
    signal,
  });
  const body = await response.json() as AucklandEventsResult | { error?: unknown };
  if (!response.ok || !("events" in body) || !Array.isArray(body.events)) {
    throw new Error("Recommendation feed unavailable");
  }
  return body.events;
}

function RecommendationSection({ title, body, items, language, offset }: {
  title: string;
  body: string;
  items: EventRecommendation[];
  language: "en" | "zh";
  offset: number;
}) {
  if (!items.length) return null;
  return (
    <section className="recommendation-section" aria-labelledby={`recommendation-${offset}`}>
      <header>
        <p>{String(offset + 1).padStart(2, "0")} / CURATED</p>
        <h2 id={`recommendation-${offset}`}>{title}</h2>
        <span>{body}</span>
      </header>
      <ol className="recommendation-grid">
        {items.map((item, index) => (
          <li key={item.event.id}>
            <RecommendationCard {...item} index={offset + index} language={language} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RecommendationsPageContent({
  requestFeed = requestRecommendationFeed,
  now = () => new Date(),
}: {
  requestFeed?: RecommendationFeedRequest;
  now?: () => Date;
}) {
  const { language } = useLanguage();
  const { bookmarks, isHydrated } = useBookmarks();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FeedState>({ status: "loading" });
  const content = copy[language];

  useEffect(() => {
    document.title = language === "zh" ? "奥克兰活动推荐 — KiwiCue" : "Auckland event picks — KiwiCue";
  }, [language]);

  useEffect(() => {
    if (!isHydrated) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    Promise.allSettled([
      requestFeed("events", controller.signal),
      requestFeed("markets", controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const successful = results.filter((result): result is PromiseFulfilledResult<KiwiCueEvent[]> => result.status === "fulfilled");
      if (!successful.length) return setState({ status: "error" });
      setState({
        status: "ready",
        events: successful.flatMap((result) => result.value),
        partial: successful.length !== results.length,
      });
    });
    return () => controller.abort();
  }, [attempt, isHydrated, requestFeed]);

  const sections = useMemo(() => state.status === "ready"
    ? buildEventRecommendations({
        events: state.events,
        savedEvents: bookmarks.map((bookmark) => bookmark.event),
        now: now(),
      })
    : null, [bookmarks, now, state]);
  const hasPicks = sections && Object.values(sections).some((items) => items.length);

  return (
    <main className="recommendations-page">
      <PortalHeader currentPage="recommendations" skipTarget="recommendation-results" />
      <section className="recommendations-hero" aria-labelledby="recommendations-title">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 className="editorial-display" id="recommendations-title">{content.title}</h1>
        <p>{content.intro}</p>
        <aside>{content.privacy}</aside>
      </section>
      <div id="recommendation-results" tabIndex={-1}>
        {state.status === "loading" && (
          <section className="recommendation-state" role="status" aria-busy="true">
            <p>{content.loading}</p><EventGridSkeleton count={4} />
          </section>
        )}
        {state.status === "error" && (
          <section className="recommendation-state recommendation-error">
            <h2>{content.errorTitle}</h2><p>{content.errorBody}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>{content.retry}</button>
          </section>
        )}
        {state.status === "ready" && state.partial && (
          <aside className="recommendation-notice" role="status">
            <div><strong>{content.partial}</strong><span>{content.partialBody}</span></div>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>{content.retry}</button>
          </aside>
        )}
        {state.status === "ready" && !hasPicks && (
          <section className="recommendation-state">
            <h2>{content.emptyTitle}</h2><p>{content.emptyBody}</p>
            <Link href="/events">{content.browse}</Link>
          </section>
        )}
        {sections && hasPicks && (
          <div className="recommendation-sections">
            <RecommendationSection title={content.startTitle} body={content.startBody} items={sections.startHere} language={language} offset={0} />
            <RecommendationSection title={content.weekendTitle} body={content.weekendBody} items={sections.weekend} language={language} offset={3} />
            <RecommendationSection title={content.differentTitle} body={content.differentBody} items={sections.somethingDifferent} language={language} offset={7} />
          </div>
        )}
      </div>
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
