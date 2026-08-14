"use client";

import Link from "next/link";
import { HomeEventPreview } from "./home-event-preview";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

const copy = {
  en: {
    eyebrow: "Auckland, in time to make a plan",
    title: "Find something worth leaving home for.",
    intro: "Concerts, theatre, markets, festivals and movies—sorted by when they happen, with the useful details close at hand.",
    action: "Browse Auckland events",
    actionNote: "Official listings and verified local schedules.",
    coverageLabel: "Browse Auckland by event type",
    signals: [
      { category: "concerts", label: "Concerts", note: "Tours, gigs and live music", ariaLabel: "Explore Concerts" },
      { category: "theatre", label: "Theatre", note: "Plays, comedy and performance", ariaLabel: "Explore Theatre" },
      { category: "markets", label: "Markets", note: "Food, makers and weekend finds", ariaLabel: "Explore Markets" },
      { category: "festivals", label: "Festivals", note: "Culture, community and city life", ariaLabel: "Explore Festivals" },
    ],
    why: "A clearer city guide",
    promiseTitle: "Useful dates first. Noise last.",
    promises: [
      { title: "Useful dates first", body: "See what is coming up while there is still time to plan, book and go." },
      { title: "Auckland in one view", body: "Spend less time checking scattered posts, ticket sites and community pages." },
      { title: "Clear source links", body: "Open the official event or ticket page when you are ready for the details." },
    ],
    footer: "Independent Auckland event discovery",
  },
  zh: {
    eyebrow: "趁还来得及安排，发现奥克兰",
    title: "找一件值得出门的事。",
    intro: "演唱会、话剧、市集、节日和电影，按发生时间整理；想知道的日期、地点和官网入口都放在近处。",
    action: "浏览奥克兰活动",
    actionNote: "官方活动信息与已核实的本地日程。",
    coverageLabel: "按活动类型浏览奥克兰",
    signals: [
      { category: "concerts", label: "演唱会", note: "巡演、现场音乐与演出", ariaLabel: "查看演唱会" },
      { category: "theatre", label: "话剧演出", note: "戏剧、喜剧与舞台表演", ariaLabel: "查看话剧演出" },
      { category: "markets", label: "市集", note: "美食、手作与周末发现", ariaLabel: "查看市集" },
      { category: "festivals", label: "节日活动", note: "文化、社区与城市生活", ariaLabel: "查看节日活动" },
    ],
    why: "更清晰的城市指南",
    promiseTitle: "有用日期在前，噪音在后。",
    promises: [
      { title: "先看有用日期", body: "趁还有时间安排、订票和出发，先看到真正快要发生的活动。" },
      { title: "一个入口看奥克兰", body: "少花时间翻找零散帖子、票务网站和社区页面。" },
      { title: "来源清清楚楚", body: "需要详情时，直接前往主办方或官方票务页面。" },
    ],
    footer: "独立的奥克兰活动发现平台",
  },
} as const;

export function HomeContent() {
  const { language } = useLanguage();
  const content = copy[language];

  return (
    <main className="home-page">
      <PortalHeader currentPage="events" skipTarget="home-content" />

      <section className="home-hero" id="home-content" aria-labelledby="hero-title">
        <div className="home-hero-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 className="editorial-display" id="hero-title">{content.title}</h1>
          <p className="home-hero-intro">{content.intro}</p>
          <div className="home-hero-actions">
            <Link className="home-primary-action" href="/events">{content.action}<span aria-hidden="true"> ↗</span></Link>
            <span>{content.actionNote}</span>
          </div>
        </div>
        <HomeEventPreview language={language} />
      </section>

      <nav className="home-index" aria-label={content.coverageLabel}>
        {content.signals.map((signal, index) => (
          <Link className="home-index-row" href={`/events?category=${signal.category}`} key={signal.category} aria-label={signal.ariaLabel}>
            <span>0{index + 1}</span>
            <strong>{signal.label}</strong>
            <small>{signal.note}</small>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>

      <section className="home-promise" aria-labelledby="promise-title">
        <p className="eyebrow">{content.why}</p>
        <h2 className="editorial-display" id="promise-title">{content.promiseTitle}</h2>
        <div className="home-promise-grid">
          {content.promises.map((promise, index) => (
            <article key={promise.title}>
              <span>0{index + 1}</span>
              <h3>{promise.title}</h3>
              <p>{promise.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="portal-footer">
        <span>KiwiCue / 纽村小报</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
