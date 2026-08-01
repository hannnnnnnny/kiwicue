"use client";

import Link from "next/link";
import { EVENT_CATEGORIES, type EventCategory } from "../lib/event-categories";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    label: "Event categories",
    title: "Browse by type",
    all: "All",
    concerts: "Concerts",
    theatre: "Theatre",
    markets: "Markets",
    festivals: "Festivals",
  },
  zh: {
    label: "活动类型",
    title: "按类型浏览",
    all: "全部",
    concerts: "演唱会",
    theatre: "话剧演出",
    markets: "市集",
    festivals: "节日活动",
  },
} as const;

type EventCategoryNavProps = EventSearchState;

export function EventCategoryNav({
  window,
  category,
  keyword,
  venueId,
}: EventCategoryNavProps) {
  const { language } = useLanguage();
  const content = copy[language];
  const categories: Array<EventCategory | null> = [null, ...EVENT_CATEGORIES];

  return (
    <section className="portal-filter-group">
      <p className="portal-filter-label">{content.title}</p>
      <nav className="portal-nav-track" aria-label={content.label}>
        {categories.map((value) => (
          <Link
            className="portal-nav-link"
            href={eventSearchHref({ window, category: value, keyword, venueId })}
            aria-current={category === value ? "page" : undefined}
            key={value ?? "all"}
          >
            {value ? content[value] : content.all}
          </Link>
        ))}
      </nav>
    </section>
  );
}
