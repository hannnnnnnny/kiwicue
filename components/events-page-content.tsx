"use client";

import { useEffect } from "react";
import { EventExplorer } from "../app/events/event-explorer";
import type { EventCategory } from "../lib/event-categories";
import type { EventSort, EventView } from "../lib/event-search-params";
import type { EventWindow } from "../lib/event-window";
import { CuratedMarketDiscovery } from "./curated-market-discovery";
import { DiscoverFilters } from "./discover-filters";
import { EventSearchPanel } from "./event-search-panel";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";
import { SiteFooter } from "./site-footer";

const windowLabels = {
  en: { tonight: "Tonight", "7d": "Next 7 days", weekend: "This weekend", "30d": "Next 30 days", all: "All future" },
  zh: { tonight: "今晚", "7d": "未来 7 天", weekend: "本周末", "30d": "未来 30 天", all: "全部未来" },
} as const;

const copy = {
  en: {
    eyebrow: "Discover Auckland",
    title: "What do you feel like?",
    intro: "Find something worth going out for.",
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

export function EventsPageContent({ window, category, keyword, venueId, sort = "recommended", free = false, view = "list" }: {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort?: EventSort;
  free?: boolean;
  view?: EventView;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const searchState = { window, category, keyword, venueId, sort, free, view };
  const sourceLabel = category === "markets" ? content.marketSource : content.source;
  const isFiltered = Boolean(category || keyword || venueId || free || window !== "all" || sort !== "recommended");

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

      <div className="discovery-search" aria-label={language === "zh" ? "搜索与筛选" : "Search and filters"}>
        <div className="event-discovery-controls"><EventSearchPanel {...searchState} /></div>
        <DiscoverFilters state={searchState} />
      </div>

      {isFiltered ? <div className="portal-status-strip" aria-label={content.statusLabel}>
        <span>{content.location}</span>
        <span><i aria-hidden="true" /> {sourceLabel}</span>
        <span>{windowLabels[language][window]} · {sort === "date" ? content.orderDate : content.orderRecommended}</span>
      </div> : null}

      <div id="event-results" tabIndex={-1}>
        <EventExplorer {...searchState} />
        <CuratedMarketDiscovery {...searchState} />
      </div>

      <section className="portal-about">
        <h2>{content.aboutTitle}</h2>
        <p>{content.aboutBody}</p>
      </section>

      <SiteFooter tagline={content.footer} />
    </main>
  );
}
