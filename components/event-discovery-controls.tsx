"use client";

import Link from "next/link";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { EventSearchPanel } from "./event-search-panel";
import { useLanguage } from "./language-provider";

const copy = {
  en: { active: "Active filters", clear: "Clear all filters", recommended: "Recommended", date: "Date", sort: "Sort results", venue: "Selected venue", categories: { concerts: "Concerts", theatre: "Theatre", markets: "Markets", festivals: "Festivals", sports: "Sports" }, windows: { "7d": "Next 7 days", weekend: "This weekend", "30d": "Next 30 days" }, remove: (label: string) => `Remove ${label} filter` },
  zh: { active: "当前筛选", clear: "清除全部筛选", recommended: "推荐排序", date: "日期排序", sort: "结果排序", venue: "所选场馆", categories: { concerts: "演唱会", theatre: "话剧演出", markets: "市集", festivals: "节日活动", sports: "体育赛事" }, windows: { "7d": "未来 7 天", weekend: "本周末", "30d": "未来 30 天" }, remove: (label: string) => `移除${label}筛选` },
} as const;

export function EventDiscoveryControls({ state }: { state: Required<EventSearchState> }) {
  const { language } = useLanguage();
  const content = copy[language];
  const chips = [
    state.keyword ? { id: "keyword", label: state.keyword, next: { ...state, keyword: null } } : null,
    state.category ? { id: "category", label: content.categories[state.category], next: { ...state, category: null } } : null,
    state.window !== "all" ? { id: "window", label: content.windows[state.window], next: { ...state, window: "all" as const } } : null,
    state.venueId ? { id: "venue", label: content.venue, next: { ...state, venueId: null } } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);
  const hasFilters = chips.length > 0 || state.sort !== "recommended";
  return (
    <div className="event-discovery-controls">
      <EventSearchPanel {...state} />
      <div className="event-control-meta">
        {chips.length > 0 && <nav className="event-active-filters" aria-label={content.active}>
          {chips.map((chip) => <Link key={chip.id} href={eventSearchHref(chip.next)} aria-label={content.remove(chip.label)}>{chip.label}<span aria-hidden="true"> ×</span></Link>)}
        </nav>}
        <nav className="event-sort-links" aria-label={content.sort}>
          <Link href={eventSearchHref({ ...state, sort: "recommended" })} aria-label={language === "en" ? "Sort by recommended" : "按推荐排序"} aria-current={state.sort === "recommended" ? "page" : undefined}>{content.recommended}</Link>
          <Link href={eventSearchHref({ ...state, sort: "date" })} aria-label={language === "en" ? "Sort by date" : "按日期排序"} aria-current={state.sort === "date" ? "page" : undefined}>{content.date}</Link>
        </nav>
        {hasFilters && <Link className="event-clear-all" href="/events">{content.clear}</Link>}
      </div>
    </div>
  );
}
