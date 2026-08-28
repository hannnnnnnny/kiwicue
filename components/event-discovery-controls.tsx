"use client";

import Link from "next/link";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { EventSearchPanel } from "./event-search-panel";
import { useLanguage } from "./language-provider";

const copy = {
  en: { active: "Active filters", clear: "Clear all filters", recommended: "Recommended", date: "Date", sort: "Sort results", remove: (label: string) => `Remove ${label} filter` },
  zh: { active: "当前筛选", clear: "清除全部筛选", recommended: "推荐排序", date: "日期排序", sort: "结果排序", remove: (label: string) => `移除${label}筛选` },
} as const;

export function EventDiscoveryControls({ state }: { state: Required<EventSearchState> }) {
  const { language } = useLanguage();
  const content = copy[language];
  const chips = [
    state.keyword ? { id: "keyword", label: state.keyword, next: { ...state, keyword: null } } : null,
    state.category ? { id: "category", label: state.category, next: { ...state, category: null } } : null,
    state.window !== "all" ? { id: "window", label: state.window, next: { ...state, window: "all" as const } } : null,
    state.venueId ? { id: "venue", label: state.venueId, next: { ...state, venueId: null } } : null,
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
