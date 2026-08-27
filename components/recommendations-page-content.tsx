"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildEventRecommendations, type EventRecommendation } from "../lib/event-recommendations";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";
import { useBookmarks } from "./bookmark-provider";
import { EventCategoryNav } from "./event-category-nav";
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
  | { status: "ready"; attempt: number; events: KiwiCueEvent[]; partial: boolean }
  | { status: "error"; attempt: number };

const copy = {
  en: {
    eyebrow: "Auckland shortlist",
    title: "Picks for you",
    intro: "A smaller, explainable shortlist built from timing, event detail and what you save.",
    privacyEmpty: "Save an event to tune future picks. Preferences stay in this browser and are never sent away.",
    privacySaved: (count: number) => `Uses ${count} ${count === 1 ? "event" : "events"} saved in this browser. KiwiCue never sends them away to build picks.`,
    loading: "Building your Auckland shortlist",
    partial: "Some recommendations could not be refreshed.",
    partialBody: "Showing the useful picks we could verify. Try again to restore the full mix.",
    retry: "Try again",
    curated: "CURATED",
    startTitle: "Start here",
    startBody: "The strongest mix of timing, detail and your saved preferences.",
    weekendTitle: "This weekend",
    weekendBody: "Plans that fit Auckland’s upcoming Saturday and Sunday.",
    differentTitle: "Try something different",
    differentBodySaved: "A change of pace from the category you save most often.",
    differentBodyEmpty: "A broad mix beyond the first shortlist, with different event types kept visible.",
    emptyTitle: "No fresh picks yet",
    emptyBody: "There are no eligible upcoming events in the current feeds. The full finder may still have later dates.",
    browse: "Browse all events",
    saved: "Open saved events",
    sourceCount: (count: number, feeds: number) => `Reviewed ${count} upcoming ${count === 1 ? "listing" : "listings"} from ${feeds} available ${feeds === 1 ? "feed" : "feeds"}.`,
    sourceNote: "Recommendations use timing, listing detail and browser-local saves—not popularity. Final details and availability remain with the official source.",
    errorTitle: "Recommendations are temporarily unavailable",
    errorBody: "Both event feeds are out of range. Nothing from your saved list was lost.",
    footer: "A shorter path to a good Auckland plan.",
  },
  zh: {
    eyebrow: "奥克兰精选",
    title: "为你推荐",
    intro: "根据时间、活动信息完整度和你的收藏，生成更精简、理由透明的推荐清单。",
    privacyEmpty: "收藏活动后可优化未来推荐。偏好只保存在当前浏览器，不会发送到外部。",
    privacySaved: (count: number) => `使用当前浏览器中收藏的 ${count} 个活动生成偏好，KiwiCue 不会将它们发送到外部。`,
    loading: "正在生成你的奥克兰精选",
    partial: "部分推荐暂时无法刷新。",
    partialBody: "先显示目前能够核实的推荐；可以重试以恢复完整内容。",
    retry: "重试",
    curated: "精选",
    startTitle: "从这里开始",
    startBody: "综合时间、信息完整度和收藏偏好的优先选择。",
    weekendTitle: "本周末",
    weekendBody: "适合奥克兰这个周六和周日的安排。",
    differentTitle: "换个口味",
    differentBodySaved: "避开你最常收藏的类型，发现不同选择。",
    differentBodyEmpty: "在首选清单之外保留不同活动类型，提供更广泛的选择。",
    emptyTitle: "暂时没有新的推荐",
    emptyBody: "当前信息源里没有符合条件的未来活动，完整活动页可能还有更远日期。",
    browse: "浏览全部活动",
    saved: "打开收藏活动",
    sourceCount: (count: number, feeds: number) => `已查看 ${feeds} 个可用信息源中的 ${count} 条未来活动。`,
    sourceNote: "推荐只依据时间、信息完整度和浏览器本地收藏，不代表热门程度；最终详情与余票以官方来源为准。",
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

function mergeUniqueEvents(events: KiwiCueEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function RecommendationSection({ title, body, marker, items, language, offset, sectionNumber }: {
  title: string;
  body: string;
  marker: string;
  items: EventRecommendation[];
  language: "en" | "zh";
  offset: number;
  sectionNumber: number;
}) {
  const sectionId = `recommendation-section-${sectionNumber}`;
  return (
    <section className="recommendation-section" aria-labelledby={sectionId}>
      <header>
        <p>{String(sectionNumber).padStart(2, "0")} / {marker}</p>
        <h2 id={sectionId}>{title}</h2>
        <span>{body}</span>
      </header>
      <ol className="recommendation-grid" data-count={items.length}>
        {items.map((item, index) => (
          <li key={item.event.id}>
            <RecommendationCard {...item} index={offset + index} language={language} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CategoryShortcuts() {
  return (
    <div className="recommendation-shortcuts">
      <EventCategoryNav window="30d" category={null} keyword={null} venueId={null} showCurrent={false} />
    </div>
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
    Promise.allSettled([
      requestFeed("events", controller.signal),
      requestFeed("markets", controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const successful = results.filter((result): result is PromiseFulfilledResult<KiwiCueEvent[]> => result.status === "fulfilled");
      if (!successful.length) return setState({ status: "error", attempt });
      setState({
        status: "ready",
        attempt,
        events: mergeUniqueEvents(successful.flatMap((result) => result.value)),
        partial: successful.length !== results.length,
      });
    });
    return () => controller.abort();
  }, [attempt, isHydrated, requestFeed]);

  const currentState: FeedState = state.status !== "loading" && state.attempt === attempt
    ? state
    : { status: "loading" };
  const sections = currentState.status === "ready"
    ? buildEventRecommendations({
        events: currentState.events,
        savedEvents: bookmarks.map((bookmark) => bookmark.event),
        now: now(),
      })
    : null;
  const hasPicks = sections && Object.values(sections).some((items) => items.length);
  const visibleSections = sections ? [
    { title: content.startTitle, body: content.startBody, items: sections.startHere },
    { title: content.weekendTitle, body: content.weekendBody, items: sections.weekend },
    {
      title: content.differentTitle,
      body: bookmarks.length ? content.differentBodySaved : content.differentBodyEmpty,
      items: sections.somethingDifferent,
    },
  ].filter((section) => section.items.length) : [];

  return (
    <main className="recommendations-page">
      <PortalHeader currentPage="recommendations" skipTarget="recommendation-results" />
      <section className="recommendations-hero" aria-labelledby="recommendations-title">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 className="editorial-display" id="recommendations-title">{content.title}</h1>
        <p>{content.intro}</p>
        <aside>{bookmarks.length ? content.privacySaved(bookmarks.length) : content.privacyEmpty}</aside>
      </section>
      <div id="recommendation-results" tabIndex={-1}>
        {currentState.status === "loading" && (
          <section className="recommendation-state" role="status" aria-busy="true">
            <p>{content.loading}</p><EventGridSkeleton count={4} />
          </section>
        )}
        {currentState.status === "error" && (
          <section className="recommendation-state recommendation-error" role="alert">
            <h2>{content.errorTitle}</h2><p>{content.errorBody}</p>
            <div className="recommendation-state-actions">
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>{content.retry}</button>
              <Link href="/events">{content.browse}</Link>
              <Link href="/saved">{content.saved}</Link>
            </div>
          </section>
        )}
        {currentState.status === "ready" && currentState.partial && (
          <aside className="recommendation-notice" role="status">
            <div><strong>{content.partial}</strong><span>{content.partialBody}</span></div>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>{content.retry}</button>
          </aside>
        )}
        {currentState.status === "ready" && !hasPicks && (
          <section className="recommendation-state">
            <h2>{content.emptyTitle}</h2><p>{content.emptyBody}</p>
            <Link href="/events">{content.browse}</Link>
          </section>
        )}
        {sections && hasPicks && (
          <div className="recommendation-sections">
            {visibleSections.map((section, index) => {
              const offset = visibleSections.slice(0, index)
                .reduce((total, item) => total + item.items.length, 0);
              return <RecommendationSection {...section} marker={content.curated} language={language} offset={offset} sectionNumber={index + 1} key={section.title} />;
            })}
          </div>
        )}
        {currentState.status === "ready" && (
          <>
            <CategoryShortcuts />
            <aside className="recommendation-source-note">
              <strong>{content.sourceCount(currentState.events.length, currentState.partial ? 1 : 2)}</strong>
              <p>{content.sourceNote}</p>
            </aside>
          </>
        )}
      </div>
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
