"use client";

import Link from "next/link";
import { EVENT_CATEGORIES, type EventCategory } from "../lib/event-categories";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    label: "Event categories",
    title: "Browse by type",
    items: {
      all: { code: "00", label: "All", description: "A broad mix, ordered by date" },
      concerts: { code: "01", label: "Concerts", description: "Live music and touring artists" },
      theatre: { code: "02", label: "Theatre", description: "Plays, comedy and live performance" },
      markets: { code: "03", label: "Markets", description: "Food, makers and neighbourhood finds" },
      festivals: { code: "04", label: "Festivals", description: "Big days and cultural gatherings" },
      sports: { code: "05", label: "Sports", description: "Live sport across Auckland" },
    },
  },
  zh: {
    label: "活动类型",
    title: "按类型浏览",
    items: {
      all: { code: "00", label: "全部", description: "按日期查看各种近期活动" },
      concerts: { code: "01", label: "演唱会", description: "现场音乐与巡演艺人" },
      theatre: { code: "02", label: "话剧演出", description: "戏剧、喜剧与现场表演" },
      markets: { code: "03", label: "市集", description: "美食、手作与社区发现" },
      festivals: { code: "04", label: "节日活动", description: "大型节庆与文化聚会" },
      sports: { code: "05", label: "体育赛事", description: "奥克兰现场体育活动" },
    },
  },
} as const;

type EventCategoryNavProps = EventSearchState;

export function EventCategoryNav({
  window,
  category,
  keyword,
  venueId,
  showCurrent = true,
}: EventCategoryNavProps & { showCurrent?: boolean }) {
  const { language } = useLanguage();
  const content = copy[language];
  const categories: Array<EventCategory | null> = [null, ...EVENT_CATEGORIES];

  return (
    <section className="portal-filter-group event-category-group">
      <p className="portal-filter-label">{content.title}</p>
      <nav className="event-category-grid" aria-label={content.label}>
        {categories.map((value) => {
          const item = value ? content.items[value] : content.items.all;
          return (
            <Link
              className="event-category-card"
              data-category={value ?? "all"}
              href={eventSearchHref({ window, category: value, keyword, venueId })}
              aria-current={showCurrent && category === value ? "page" : undefined}
              key={value ?? "all"}
            >
              <span className="event-category-code" aria-hidden="true">{item.code}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
