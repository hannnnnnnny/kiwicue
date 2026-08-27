"use client";

import Link from "next/link";
import { EVENT_WINDOWS, type EventWindow } from "../lib/event-window";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    label: "Event time range",
    title: "When do you want to go?",
    "7d": "Next 7 days",
    weekend: "This weekend",
    "30d": "Next 30 days",
    all: "All future",
  },
  zh: {
    label: "时间范围",
    title: "你想什么时候去？",
    "7d": "未来 7 天",
    weekend: "本周末",
    "30d": "未来 30 天",
    all: "全部未来",
  },
} as const;

type EventWindowNavProps = EventSearchState;

export function EventWindowNav({
  window,
  category,
  keyword,
  venueId,
}: EventWindowNavProps) {
  const { language } = useLanguage();
  const content = copy[language];

  return (
    <section className="portal-filter-group event-window-group">
      <p className="portal-filter-label">{content.title}</p>
      <nav className="portal-nav-track" aria-label={content.label}>
        {EVENT_WINDOWS.map((value: EventWindow) => (
          <Link
            className="portal-nav-link"
            href={eventSearchHref({ window: value, category, keyword, venueId })}
            aria-current={window === value ? "page" : undefined}
            key={value}
          >
            {content[value]}
          </Link>
        ))}
      </nav>
    </section>
  );
}
