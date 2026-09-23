"use client";

import { useEffect } from "react";
import { EventExplorer } from "../app/events/event-explorer";
import type { EventCategory } from "../lib/event-categories";
import type { EventSort } from "../lib/event-search-params";
import type { EventWindow } from "../lib/event-window";
import { EventCategoryNav } from "./event-category-nav";
import { CuratedMarketDiscovery } from "./curated-market-discovery";
import { EventDiscoveryControls } from "./event-discovery-controls";
import { EventWindowNav } from "./event-window-nav";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

const windowLabels = {
  en: { "7d": "Next 7 days", weekend: "This weekend", "30d": "Next 30 days", all: "All future" },
  zh: { "7d": "未来 7 天", weekend: "本周末", "30d": "未来 30 天", all: "全部未来" },
} as const;

const copy = {
  en: {
    eyebrow: "Discover Auckland",
    title: "What do you feel like?",
    intro: "Find something worth going out for.",
    filterTitle: "What are you into?",
    filterBody: "Pick a date, find your scene, make it happen.",
    statusLabel: "Current event search",
    location: "Auckland",
    source: "Ticketmaster source",
    marketSource: "KiwiCue verified schedules",
    orderDate: "Soonest first",
    orderRecommended: "Recommended within each date",
    aboutTitle: "Useful first, noise last.",
    aboutBody: "KiwiCue organizes Auckland events by time, type and venue so you can reach the useful detail quickly. Ticket availability and final details remain with the official source.",
    footer: "Auckland events, easier to find.",
  },
  zh: {
    eyebrow: "探索奥克兰",
    title: "今天，想做点什么？",
    intro: "发现让你想出门的奥克兰。",
    filterTitle: "今天，想去哪里？",
    filterBody: "选个时间，找到喜欢的现场，然后出发。",
    statusLabel: "当前活动检索范围",
    location: "奥克兰",
    source: "Ticketmaster 官方来源",
    marketSource: "KiwiCue 已核实日程",
    orderDate: "最早发生优先",
    orderRecommended: "同日活动按推荐排序",
    aboutTitle: "有用的信息在前，噪音在后。",
    aboutBody: "KiwiCue 按时间、类型和场馆整理奥克兰活动，让你更快找到有用信息。余票与最终活动详情以官方来源为准。",
    footer: "奥克兰活动，更容易找到。",
  },
} as const;

export function EventsPageContent({ window, category, keyword, venueId, sort = "recommended" }: {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort?: EventSort;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const searchState = { window, category, keyword, venueId, sort };
  const sourceLabel = category === "markets" ? content.marketSource : content.source;
  const isFiltered = Boolean(category || keyword || venueId || window !== "all" || sort !== "recommended");

  useEffect(() => {
    document.title = language === "zh"
      ? "奥克兰活动 — KiwiCue"
      : "Auckland events — KiwiCue";
  }, [language]);

  return (
    <main className="events-page">
      <PortalHeader />

      <section className="portal-command" data-filtered={isFiltered} aria-labelledby="events-title">
        <div className="portal-command-inner">
          <div className="portal-command-copy">
            <p className="eyebrow">{content.eyebrow}</p>
            <h1 className="editorial-display" id="events-title">{content.title}</h1>
            <p className="portal-intro">{content.intro}</p>
          </div>
        </div>
      </section>

      <details className="discovery-search" open={isFiltered || undefined}>
        <summary>{language === "zh" ? "搜索与筛选" : "Search & filters"}<span aria-hidden="true">⌕</span></summary>
        <EventDiscoveryControls state={searchState} />
        <section className="portal-navigation-shell" aria-labelledby="discovery-filter-title">
          <div className="portal-filter-intro">
            <h2 id="discovery-filter-title">{content.filterTitle}</h2>
            <p>{content.filterBody}</p>
          </div>
          <EventCategoryNav {...searchState} />
          <EventWindowNav {...searchState} />
        </section>
      </details>

      <div className="portal-status-strip" aria-label={content.statusLabel}>
        <span>{content.location}</span>
        <span><i aria-hidden="true" /> {sourceLabel}</span>
        <span>{windowLabels[language][window]} · {sort === "date" ? content.orderDate : content.orderRecommended}</span>
      </div>

      <div id="event-results" tabIndex={-1}>
        <EventExplorer {...searchState} />
        <CuratedMarketDiscovery {...searchState} />
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
