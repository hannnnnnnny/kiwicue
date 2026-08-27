"use client";

import Link from "next/link";
import Image from "next/image";
import { useBookmarks } from "./bookmark-provider";
import { LanguageToggle } from "./language-toggle";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    skip: "Skip to event results",
    skipHome: "Skip to Auckland guide",
    skipDetail: "Skip to event details",
    skipSaved: "Skip to saved events",
    skipMovies: "Skip to movie sessions",
    skipMoviePreviews: "Skip to movie previews",
    skipCinemaDirectory: "Skip to Auckland cinema links",
    skipMovieDetail: "Skip to movie details",
    skipRecommendations: "Skip to recommendations",
    homeLabel: "KiwiCue Auckland events home",
    primaryNavigation: "Primary navigation",
    events: "Events",
    movies: "Movies",
    recommendations: "Picks",
    saved: "Saved",
    savedLabel: (count: number) => `Saved events, ${count}`,
  },
  zh: {
    skip: "跳到活动结果",
    skipHome: "跳到奥克兰指南",
    skipDetail: "跳到活动详情",
    skipSaved: "跳到收藏活动",
    skipMovies: "跳到电影场次",
    skipMoviePreviews: "跳到电影预览",
    skipCinemaDirectory: "跳到奥克兰影院入口",
    skipMovieDetail: "跳到电影详情",
    skipRecommendations: "跳到推荐内容",
    homeLabel: "KiwiCue 奥克兰活动首页",
    primaryNavigation: "主要导航",
    events: "活动",
    movies: "电影",
    recommendations: "推荐",
    saved: "收藏",
    savedLabel: (count: number) => `收藏活动，${count} 个`,
  },
} as const;

type PortalPage = "events" | "movies" | "recommendations" | "saved";
type SkipTarget = "home-content" | "event-results" | "event-detail" | "saved-events" | "movie-results" | "movie-previews" | "movie-detail" | "cinema-directory" | "recommendation-results";

function getSkipLabel(skipTarget: SkipTarget, content: typeof copy.en | typeof copy.zh): string {
  const labels: Record<SkipTarget, string> = {
    "home-content": content.skipHome,
    "event-results": content.skip,
    "event-detail": content.skipDetail,
    "saved-events": content.skipSaved,
    "movie-results": content.skipMovies,
    "movie-previews": content.skipMoviePreviews,
    "cinema-directory": content.skipCinemaDirectory,
    "movie-detail": content.skipMovieDetail,
    "recommendation-results": content.skipRecommendations,
  };
  return labels[skipTarget];
}

export function PortalHeader({ skipTarget = "event-results", currentPage }: {
  skipTarget?: SkipTarget;
  currentPage?: PortalPage;
} = {}) {
  const { language } = useLanguage();
  const { count } = useBookmarks();
  const content = copy[language];
  const activePage = currentPage ?? (skipTarget === "saved-events" ? "saved" : "events");
  const skipLabel = getSkipLabel(skipTarget, content);

  return (
    <>
      <a className="skip-link" href={`#${skipTarget}`}>
        {skipLabel}
      </a>
      <div className="portal-header-shell">
        <header className="portal-header">
          <Link className="portal-brand" href="/" aria-label={content.homeLabel}>
            <Image
              className="portal-brand-wordmark"
              src="/brand/kiwicue-wordmark.png"
              alt=""
              width={1200}
              height={281}
              priority
            />
            <Image
              className="portal-brand-symbol"
              src="/brand/kiwicue-mark.png"
              alt=""
              width={337}
              height={256}
              priority
            />
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
                className="portal-header-link"
                href="/recommendations"
                aria-current={activePage === "recommendations" ? "page" : undefined}
              >
                {content.recommendations}
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
      </div>
    </>
  );
}
