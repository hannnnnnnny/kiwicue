"use client";

import Link from "next/link";
import { LanguageToggle } from "./language-toggle";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    pilot: "Auckland pilot",
    eyebrow: "A clearer signal for what is happening next",
    title: "Auckland events, before you miss them",
    intro: "One timely, well-sorted view of concerts, theatre, markets, festivals and local events—without hoping an algorithm shows you the post before it is too late.",
    action: "Explore Auckland events",
    actionNote: "Live event discovery is connected now.",
    scope: "AKL — NEXT 365 DAYS",
    live: "LIVE NOW",
    coverageLabel: "KiwiCue coverage",
    signals: [
      { category: "concerts", label: "Concerts", note: "Tours, gigs and live music", ariaLabel: "Explore Concerts" },
      { category: "theatre", label: "Theatre", note: "Plays, comedy and performance", ariaLabel: "Explore Theatre" },
      { category: "markets", label: "Markets", note: "Food, makers and weekend finds", ariaLabel: "Explore Markets" },
      { category: "festivals", label: "Festivals", note: "Culture, community and city life", ariaLabel: "Explore Festivals" },
    ],
    why: "Why KiwiCue",
    promiseTitle: "Sorted for timing, not engagement.",
    promises: [
      { title: "Useful dates first", body: "See what is coming up while there is still time to plan, book and go." },
      { title: "Auckland in one view", body: "Spend less time checking scattered posts, ticket sites and community pages." },
      { title: "Clear source links", body: "Open the official event or ticket page when you are ready for the details." },
    ],
    footer: "Independent Auckland event discovery",
  },
  zh: {
    pilot: "奥克兰首发",
    eyebrow: "更清晰地捕捉下一件值得去的事",
    title: "在错过之前，发现奥克兰",
    intro: "把演唱会、话剧、集市、节日和本地活动放进一个及时、好排序的入口——不用再赌算法会不会在活动结束后才推给你。",
    action: "查看奥克兰活动",
    actionNote: "实时活动信息现已接通。",
    scope: "奥克兰 — 未来 365 天",
    live: "实时更新",
    coverageLabel: "KiwiCue 活动范围",
    signals: [
      { category: "concerts", label: "演唱会", note: "巡演、现场音乐与演出", ariaLabel: "查看演唱会" },
      { category: "theatre", label: "话剧演出", note: "戏剧、喜剧与舞台表演", ariaLabel: "查看话剧演出" },
      { category: "markets", label: "市集", note: "美食、手作与周末发现", ariaLabel: "查看市集" },
      { category: "festivals", label: "节日活动", note: "文化、社区与城市生活", ariaLabel: "查看节日活动" },
    ],
    why: "为什么是 KiwiCue",
    promiseTitle: "按时间价值排序，不按互动量排序。",
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
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label={language === "en" ? "KiwiCue home" : "KiwiCue 首页"}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>KiwiCue</span>
        </Link>
        <div className="header-actions">
          <span className="pilot-badge"><i aria-hidden="true" /> {content.pilot}</span>
          <LanguageToggle />
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="hero-title">{content.title}</h1>
          <p className="hero-intro">{content.intro}</p>
          <div className="hero-actions">
            <Link className="primary-action" href="/events">{content.action} <span aria-hidden="true">↗</span></Link>
            <span className="action-note">{content.actionNote}</span>
          </div>
        </div>

        <aside className="signal-card" aria-label={content.coverageLabel}>
          <div className="signal-card-top">
            <span>{content.scope}</span>
            <span className="live-label">{content.live}</span>
          </div>
          <div className="signal-list">
            {content.signals.map((signal, index) => (
              <Link
                className="signal-row"
                href={`/events?category=${signal.category}`}
                key={signal.category}
                aria-label={signal.ariaLabel}
              >
                <span className="signal-number">0{index + 1}</span>
                <span className="signal-copy"><strong>{signal.label}</strong><small>{signal.note}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="promise" aria-labelledby="promise-title">
        <p className="eyebrow">{content.why}</p>
        <h2 id="promise-title">{content.promiseTitle}</h2>
        <div className="promise-grid">
          {content.promises.map((promise, index) => (
            <article key={promise.title}>
              <span>0{index + 1}</span>
              <h3>{promise.title}</h3>
              <p>{promise.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>KiwiCue / 纽村小报</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
