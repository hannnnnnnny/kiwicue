"use client";

import Link from "next/link";
import Image from "next/image";
import { useBookmarks } from "./bookmark-provider";
import { LanguageToggle } from "./language-toggle";
import { AccountControl } from "./account-control";
import { useLanguage } from "./language-provider";
import { DiscoveryIcon } from "./discovery-icon";

const copy = {
  en: {
    skip: "Skip to event results",
    skipHome: "Skip to Auckland guide",
    skipDetail: "Skip to event details",
    skipSaved: "Skip to saved events",
    skipPlans: "Skip to outing plans",
    skipMovies: "Skip to movie sessions",
    skipMoviePreviews: "Skip to movie previews",
    skipCinemaDirectory: "Skip to Auckland cinema links",
    skipMovieDetail: "Skip to movie details",
    skipRecommendations: "Skip to recommendations",
    skipMain: "Skip to main content",
    homeLabel: "KiwiCue Auckland events home",
    primaryNavigation: "Primary navigation",
    mobileNavigation: "Mobile navigation",
    destinations: { discover: "Discover", "for-you": "For You", movies: "Movies", mine: "Mine" },
    mineLabel: (count: number) => `Mine: saved events, plans and collections. ${count} saved`,
  },
  zh: {
    skip: "跳到活动结果",
    skipHome: "跳到奥克兰指南",
    skipDetail: "跳到活动详情",
    skipSaved: "跳到收藏活动",
    skipPlans: "跳到我的行程",
    skipMovies: "跳到电影场次",
    skipMoviePreviews: "跳到电影预览",
    skipCinemaDirectory: "跳到奥克兰影院入口",
    skipMovieDetail: "跳到电影详情",
    skipRecommendations: "跳到推荐内容",
    skipMain: "跳到主要内容",
    homeLabel: "KiwiCue 奥克兰活动首页",
    primaryNavigation: "主要导航",
    mobileNavigation: "手机导航",
    destinations: { discover: "发现", "for-you": "为你推荐", movies: "电影", mine: "我的" },
    mineLabel: (count: number) => `我的：收藏、行程和清单，已收藏 ${count} 个`,
  },
} as const;

/** The four places every page links to, the same on desktop and mobile. */
export type PortalPage = "discover" | "for-you" | "movies" | "mine" | "none";
type Destination = Exclude<PortalPage, "none">;
const DESTINATIONS: { id: Destination; href: string; icon: "search" | "spark" | "film" | "heart" }[] = [
  { id: "discover", href: "/events", icon: "search" },
  { id: "for-you", href: "/for-you", icon: "spark" },
  { id: "movies", href: "/movies", icon: "film" },
  { id: "mine", href: "/saved", icon: "heart" },
];
type SkipTarget = "home-content" | "event-results" | "event-detail" | "saved-events" | "movie-results" | "movie-previews" | "movie-detail" | "cinema-directory" | "recommendation-results" | "outing-plan-content" | "main-content";

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
    "outing-plan-content": content.skipPlans,
    "main-content": content.skipMain,
  };
  return labels[skipTarget];
}

function DestinationLinks({ activePage, count, content, className }: { activePage: PortalPage; count: number; content: typeof copy.en | typeof copy.zh; className?: string }) {
  return DESTINATIONS.map(({ id, href, icon }) => (
    <Link key={id} className={className} href={href} data-destination={id}
      aria-label={id === "mine" ? content.mineLabel(count) : undefined}
      aria-current={activePage === id ? "page" : undefined}>
      <DiscoveryIcon name={icon} /><span>{content.destinations[id]}</span>{id === "mine" && count > 0 ? <strong>{count}</strong> : null}
    </Link>
  ));
}

export function PortalHeader({ skipTarget = "event-results", currentPage }: {
  skipTarget?: SkipTarget;
  currentPage?: PortalPage;
} = {}) {
  const { language } = useLanguage();
  const { count } = useBookmarks();
  const content = copy[language];
  const activePage = currentPage ?? (skipTarget === "saved-events" ? "mine" : "discover");
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
              <DestinationLinks activePage={activePage} count={count} content={content} className="portal-header-link" />
            </nav>
            <LanguageToggle />
            <AccountControl language={language} />
          </div>
        </header>
      </div>
      <nav className="discovery-bottom-nav" aria-label={content.mobileNavigation}>
        <DestinationLinks activePage={activePage} count={count} content={content} />
      </nav>
    </>
  );
}
