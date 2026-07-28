"use client";

import Link from "next/link";
import { EventExplorer } from "../app/events/event-explorer";
import type { EventCategory } from "../lib/event-categories";
import { LanguageToggle } from "./language-toggle";
import { useLanguage } from "./language-provider";

const categoryLabels = {
  en: { concerts: "Concerts", theatre: "Theatre", markets: "Markets", festivals: "Festivals" },
  zh: { concerts: "演唱会", theatre: "话剧演出", markets: "市集", festivals: "节日活动" },
} as const;

const copy = {
  en: {
    homeLabel: "Back to KiwiCue home",
    home: "Home",
    eyebrow: "Auckland event signal / Live discovery",
    titleLead: "What’s on, ",
    titleAccent: "before it’s gone",
    intro: "Upcoming concerts, theatre, festivals and live events in one chronological feed—so the useful date reaches you before the recommendation does.",
    scopeLabel: "Current event search scope",
    locationLabel: "Location",
    location: "Auckland",
    windowLabel: "Window",
    window: "Next 30 days",
    orderLabel: "Order",
    order: "Soonest first",
    tickerWindow: "Auckland · Next 30 days",
    tickerSource: "Live source check",
    tickerCount: "24 results per scan",
    tickerLabel: "Event feed status",
    footer: "Find it in time. Check details at the source.",
  },
  zh: {
    homeLabel: "返回 KiwiCue 首页",
    home: "首页",
    eyebrow: "奥克兰活动雷达 / 实时发现",
    titleLead: "奥克兰有什么，",
    titleAccent: "别等错过才发现",
    intro: "把未来 30 天的演唱会、话剧、节日和现场活动按日期排好，让有用的信息赶在过期之前到达。",
    scopeLabel: "当前活动搜索范围",
    locationLabel: "地点",
    location: "奥克兰",
    windowLabel: "范围",
    window: "未来 30 天",
    orderLabel: "排序",
    order: "最早发生优先",
    tickerWindow: "奥克兰 · 未来 30 天",
    tickerSource: "实时来源检查",
    tickerCount: "每次最多 24 条",
    tickerLabel: "活动信息状态",
    footer: "及时发现，详情以官方来源为准。",
  },
} as const;

export function EventsPageContent({ category }: { category: EventCategory | null }) {
  const { language } = useLanguage();
  const content = copy[language];

  return (
    <main className="events-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label={content.homeLabel}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>KiwiCue</span>
        </Link>
        <div className="header-actions">
          <LanguageToggle />
          <Link className="home-return" href="/">{content.home} <span aria-hidden="true">↖</span></Link>
        </div>
      </header>

      <section className="events-masthead" aria-labelledby="events-title">
        <div className="events-masthead-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="events-title">{content.titleLead}<em>{content.titleAccent}</em></h1>
          <p>{content.intro}</p>
        </div>
        <aside className="events-scope" aria-label={content.scopeLabel}>
          <div><span>{content.locationLabel}</span><strong>{content.location}</strong></div>
          <div><span>{content.windowLabel}</span><strong>{content.window}</strong></div>
          <div><span>{content.orderLabel}</span><strong>{content.order}</strong></div>
        </aside>
      </section>

      <div className="events-ticker" aria-label={content.tickerLabel}>
        <span>{content.tickerWindow}</span>
        <span><i aria-hidden="true" /> {content.tickerSource}</span>
        <span>{content.tickerCount}</span>
      </div>

      {category && (
        <div className="active-filter">
          <span>
            {language === "en" ? "Showing" : "正在查看"}: <strong>{categoryLabels[language][category]}</strong>
          </span>
          <Link href="/events">{language === "en" ? "View all events" : "查看全部活动"}</Link>
        </div>
      )}

      <EventExplorer />

      <footer>
        <span>KiwiCue / 纽村小报</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
