"use client";

import { useEffect } from "react";
import { EventExplorer } from "../app/events/event-explorer";
import type { EventCategory } from "../lib/event-categories";
import type { EventWindow } from "../lib/event-window";
import { EventCategoryNav } from "./event-category-nav";
import { EventSearchPanel } from "./event-search-panel";
import { EventWindowNav } from "./event-window-nav";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

const windowLabels = {
  en: { "7d": "Next 7 days", weekend: "This weekend", "30d": "Next 30 days", all: "All future" },
  zh: { "7d": "未来 7 天", weekend: "本周末", "30d": "未来 30 天", all: "全部未来" },
} as const;

const copy = {
  en: {
    eyebrow: "Auckland · Official event listings",
    title: "What’s on in Auckland?",
    intro: "Search by event or artist, narrow the date, then open the official listing. No delayed recommendation feed.",
    statusLabel: "Current event search",
    location: "Auckland",
    source: "Ticketmaster source",
    marketSource: "KiwiCue verified schedules",
    order: "Soonest first",
    aboutTitle: "Useful first, noise last.",
    aboutBody: "KiwiCue organizes Auckland events by time, type and venue so you can reach the useful detail quickly. Ticket availability and final details remain with the official source.",
    footer: "Auckland events, easier to find.",
  },
  zh: {
    eyebrow: "奥克兰 · 官方活动信息",
    title: "奥克兰最近有什么活动？",
    intro: "搜索活动或艺人，再按时间、类型和场馆缩小范围；不必等待迟到的推荐推送。",
    statusLabel: "当前活动检索范围",
    location: "奥克兰",
    source: "Ticketmaster 官方来源",
    marketSource: "KiwiCue 已核实日程",
    order: "最早发生优先",
    aboutTitle: "有用的信息在前，噪音在后。",
    aboutBody: "KiwiCue 按时间、类型和场馆整理奥克兰活动，让你更快找到有用信息。余票与最终活动详情以官方来源为准。",
    footer: "奥克兰活动，更容易找到。",
  },
} as const;

export function EventsPageContent({ window, category, keyword, venueId }: {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const searchState = { window, category, keyword, venueId };
  const sourceLabel = category === "markets" ? content.marketSource : content.source;

  useEffect(() => {
    document.title = language === "zh"
      ? "奥克兰活动 — KiwiCue"
      : "Auckland events — KiwiCue";
  }, [language]);

  return (
    <main className="events-page">
      <PortalHeader />

      <section className="portal-command" aria-labelledby="events-title">
        <div className="portal-command-inner">
          <div className="portal-command-copy">
            <p className="eyebrow">{content.eyebrow}</p>
            <h1 className="editorial-display" id="events-title">{content.title}</h1>
            <p className="portal-intro">{content.intro}</p>
          </div>
          <EventSearchPanel {...searchState} />
        </div>
      </section>

      <div className="portal-navigation-shell">
        <EventCategoryNav {...searchState} />
        <EventWindowNav {...searchState} />
      </div>

      <div className="portal-status-strip" aria-label={content.statusLabel}>
        <span>{content.location}</span>
        <span><i aria-hidden="true" /> {sourceLabel}</span>
        <span>{windowLabels[language][window]} · {content.order}</span>
      </div>

      <div id="event-results" tabIndex={-1}>
        <EventExplorer {...searchState} />
      </div>

      <section className="portal-about">
        <h2>{content.aboutTitle}</h2>
        <p>{content.aboutBody}</p>
      </section>

      <footer className="portal-footer">
        <span>KiwiCue / 纽村小报</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
