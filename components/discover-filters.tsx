"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EVENT_CATEGORIES } from "../lib/event-categories";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import type { EventWindow } from "../lib/event-window";
import { useLanguage } from "./language-provider";

const WHEN: Exclude<EventWindow, "all">[] = ["tonight", "weekend", "7d", "30d"];

const copy = {
  en: {
    label: "Filter events", when: "When", what: "What", free: "Free", view: "View", list: "List", map: "Map",
    sort: "Sort", recommended: "Recommended", date: "Soonest", clear: "Clear all", venue: "Selected venue",
    remove: (label: string) => `Remove ${label}`,
    windows: { tonight: "Tonight", weekend: "This weekend", "7d": "Next 7 days", "30d": "Next 30 days" },
    categories: { concerts: "Concerts", theatre: "Theatre", markets: "Markets", festivals: "Festivals", sports: "Sports" },
  },
  zh: {
    label: "筛选活动", when: "时间", what: "类型", free: "免费", view: "视图", list: "列表", map: "地图",
    sort: "排序", recommended: "推荐", date: "最近", clear: "清除全部", venue: "所选场馆",
    remove: (label: string) => `移除${label}`,
    windows: { tonight: "今晚", weekend: "本周末", "7d": "未来 7 天", "30d": "未来 30 天" },
    categories: { concerts: "演唱会", theatre: "话剧演出", markets: "市集", festivals: "节日活动", sports: "体育赛事" },
  },
} as const;

/** A filter chip: a link to the same list with one thing changed. It replaces the history entry. */
function Chip({ href, on, label, children }: { href: string; on?: boolean; label?: string; children: ReactNode }) {
  return <Link className="discover-chip" href={href} replace scroll={false} aria-current={on ? "true" : undefined} aria-label={label}>{children}</Link>;
}

/**
 * Every way to narrow the list in one place: when, what, free, list or map, and sort. Each choice
 * is in the URL, so a shared link or Back shows the same list.
 */
export function DiscoverFilters({ state }: { state: Required<EventSearchState> }) {
  const { language } = useLanguage();
  const content = copy[language];
  const href = (change: Partial<EventSearchState>) => eventSearchHref({ ...state, ...change });
  const searched = [
    state.keyword ? { id: "keyword", label: state.keyword, href: href({ keyword: null }) } : null,
    state.venueId ? { id: "venue", label: content.venue, href: href({ venueId: null }) } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const filtered = state.window !== "all" || state.category !== null || state.free || searched.length > 0 || state.sort === "date";
  return (
    <div className="discover-filters" role="group" aria-label={content.label}>
      <nav className="discover-filter-row" aria-label={content.when}>
        <span className="discover-filter-label" aria-hidden="true">{content.when}</span>
        {WHEN.map((window) => (
          <Chip key={window} on={state.window === window} href={href({ window: state.window === window ? "all" : window })}>{content.windows[window]}</Chip>
        ))}
      </nav>
      <nav className="discover-filter-row" aria-label={content.what}>
        <span className="discover-filter-label" aria-hidden="true">{content.what}</span>
        {EVENT_CATEGORIES.map((category) => (
          <Chip key={category} on={state.category === category} href={href({ category: state.category === category ? null : category })}>{content.categories[category]}</Chip>
        ))}
        <Chip on={state.free} href={href({ free: !state.free })}>{content.free}</Chip>
      </nav>
      <div className="discover-filter-tools">
        <nav className="discover-segmented" aria-label={content.view}>
          <Chip on={state.view === "list"} href={href({ view: "list" })}>{content.list}</Chip>
          <Chip on={state.view === "map"} href={href({ view: "map" })}>{content.map}</Chip>
        </nav>
        <nav className="discover-segmented" aria-label={content.sort}>
          <Chip on={state.sort === "recommended"} href={href({ sort: "recommended" })}>{content.recommended}</Chip>
          <Chip on={state.sort === "date"} href={href({ sort: "date" })}>{content.date}</Chip>
        </nav>
        {searched.map((item) => <Chip key={item.id} on href={item.href} label={content.remove(item.label)}>{item.label} <span aria-hidden="true">×</span></Chip>)}
        {filtered ? <Link className="discover-clear" href={eventSearchHref({ window: "all", category: null, keyword: null, venueId: null, view: state.view })} replace scroll={false}>{content.clear}</Link> : null}
      </div>
    </div>
  );
}
