"use client";

import Link from "next/link";
import { useBookmarks } from "./bookmark-provider";
import { LanguageToggle } from "./language-toggle";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    skip: "Skip to event results",
    skipDetail: "Skip to event details",
    skipSaved: "Skip to saved events",
    skipMovies: "Skip to movie sessions",
    homeLabel: "KiwiCue Auckland events home",
    descriptor: "Auckland event finder",
    primaryNavigation: "Primary navigation",
    events: "Events",
    movies: "Movies",
    saved: "Saved",
    savedLabel: (count: number) => `Saved events, ${count}`,
  },
  zh: {
    skip: "跳到活动结果",
    skipDetail: "跳到活动详情",
    skipSaved: "跳到收藏活动",
    skipMovies: "跳到电影场次",
    homeLabel: "KiwiCue 奥克兰活动首页",
    descriptor: "奥克兰活动检索",
    primaryNavigation: "主要导航",
    events: "活动",
    movies: "电影",
    saved: "收藏",
    savedLabel: (count: number) => `收藏活动，${count} 个`,
  },
} as const;

type PortalPage = "events" | "movies" | "saved";

export function PortalHeader({ skipTarget = "event-results", currentPage }: {
  skipTarget?: "event-results" | "event-detail" | "saved-events" | "movie-results";
  currentPage?: PortalPage;
} = {}) {
  const { language } = useLanguage();
  const { count } = useBookmarks();
  const content = copy[language];
  const activePage = currentPage ?? (skipTarget === "saved-events" ? "saved" : "events");
  const skipLabel = skipTarget === "event-detail"
    ? content.skipDetail
    : skipTarget === "saved-events"
      ? content.skipSaved
      : skipTarget === "movie-results"
        ? content.skipMovies
        : content.skip;

  return (
    <>
      <a className="skip-link" href={`#${skipTarget}`}>
        {skipLabel}
      </a>
      <header className="portal-header">
        <Link className="portal-brand" href="/events" aria-label={content.homeLabel}>
          <span className="portal-brand-mark" aria-hidden="true">K</span>
          <span className="portal-brand-copy">
            <strong>KiwiCue</strong>
            <small>{content.descriptor}</small>
          </span>
        </Link>
        <div className="portal-header-actions">
          <nav className="portal-primary-nav" aria-label={content.primaryNavigation}>
            <Link
              className="portal-header-link"
              href="/events"
              aria-current={activePage === "events" ? "page" : undefined}
            >
              {content.events}
            </Link>
            <Link
              className="portal-header-link"
              href="/movies"
              aria-current={activePage === "movies" ? "page" : undefined}
            >
              {content.movies}
            </Link>
            <Link
              className="portal-header-link saved-link"
              href="/saved"
              aria-label={content.savedLabel(count)}
              aria-current={activePage === "saved" ? "page" : undefined}
            >
              <span>{content.saved}</span><strong>{count}</strong>
            </Link>
          </nav>
          <LanguageToggle />
        </div>
      </header>
    </>
  );
}
