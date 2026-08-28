"use client";

import Link from "next/link";
import { EVENT_CATEGORIES, type EventCategory } from "../lib/event-categories";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    label: "Event categories",
    title: "Browse by type",
    current: "Current category",
    items: {
      all: { kicker: "Everything", label: "All", description: "A broad mix, ordered by date" },
      concerts: { kicker: "Live sound", label: "Concerts", description: "Live music and touring artists" },
      theatre: { kicker: "On stage", label: "Theatre", description: "Plays, comedy and live performance" },
      markets: { kicker: "Local finds", label: "Markets", description: "Food, makers and neighbourhood finds" },
      festivals: { kicker: "Big days", label: "Festivals", description: "Big days and cultural gatherings" },
      sports: { kicker: "Game day", label: "Sports", description: "Live sport across Auckland" },
    },
  },
  zh: {
    label: "活动类型",
    title: "按类型浏览",
    current: "当前分类",
    items: {
      all: { kicker: "全部发现", label: "全部", description: "按日期查看各种近期活动" },
      concerts: { kicker: "现场音乐", label: "演唱会", description: "现场音乐与巡演艺人" },
      theatre: { kicker: "舞台演出", label: "话剧演出", description: "戏剧、喜剧与现场表演" },
      markets: { kicker: "社区寻宝", label: "市集", description: "美食、手作与社区发现" },
      festivals: { kicker: "城市节庆", label: "节日活动", description: "大型节庆与文化聚会" },
      sports: { kicker: "比赛现场", label: "体育赛事", description: "奥克兰现场体育活动" },
    },
  },
} as const;

type EventCategoryNavProps = EventSearchState;

function CategoryGlyph({ category }: { category: EventCategory | "all" }) {
  return (
    <svg className="event-category-glyph" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      {category === "all" && <><circle cx="32" cy="32" r="18" /><circle cx="25" cy="25" r="2" /><circle cx="39" cy="25" r="2" /><circle cx="25" cy="39" r="2" /><circle cx="39" cy="39" r="2" /></>}
      {category === "concerts" && <><path d="M12 34h8l5-16 8 30 7-24 5 10h7" /><circle cx="14" cy="20" r="4" /><circle cx="50" cy="46" r="4" /></>}
      {category === "theatre" && <><path d="M15 14h34v36H15zM15 14c10 7 13 17 13 36M49 14C39 21 36 31 36 50" /><path d="M26 30h12M28 38c3 3 5 3 8 0" /></>}
      {category === "markets" && <><path d="M13 26h38l-4-12H17l-4 12Zm4 0v24h30V26M24 50V36h16v14" /><path d="M13 26c2 7 8 7 10 0 2 7 8 7 10 0 2 7 8 7 10 0 2 7 7 7 8 0" /></>}
      {category === "festivals" && <><path d="m32 10 4 14 14-4-10 11 10 10-14-3-4 15-4-15-14 3 10-10-10-11 14 4 4-14Z" /><circle cx="32" cy="31" r="5" /></>}
      {category === "sports" && <><circle cx="32" cy="32" r="21" /><path d="m32 18 9 7-4 11H27l-4-11 9-7ZM11 32l12-7M18 48l9-12M46 48l-9-12M53 32l-12-7" /></>}
    </svg>
  );
}

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
      <nav
        className="event-category-grid"
        aria-label={content.label}
        data-active={showCurrent ? category ?? "all" : "none"}
      >
        {categories.map((value) => {
          const item = value ? content.items[value] : content.items.all;
          const categoryKey = value ?? "all";
          const isCurrent = showCurrent && category === value;
          return (
            <Link
              className="event-category-card"
              data-category={categoryKey}
              href={eventSearchHref({ window, category: value, keyword, venueId })}
              aria-label={`${item.label}. ${item.description}${isCurrent ? `. ${content.current}` : ""}`}
              aria-current={isCurrent ? "page" : undefined}
              key={categoryKey}
            >
              <CategoryGlyph category={categoryKey} />
              <span className="event-category-kicker">{item.kicker}</span>
              <strong className="event-category-name">{item.label}</strong>
              <small>{item.description}</small>
              <span className="event-category-footer">
                <span className="event-category-current">{isCurrent ? content.current : ""}</span>
                <span className="event-category-cue" aria-hidden="true">↗</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
