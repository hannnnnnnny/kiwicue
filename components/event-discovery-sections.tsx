import Link from "next/link";
import { EventCard } from "../app/events/event-card";
import { EVENT_CATEGORIES, type EventCategory } from "../lib/event-categories";
import { buildEventDiscovery, groupEventsByAucklandDate, sortDiscoveryEvents } from "../lib/event-discovery";
import { eventSearchHref } from "../lib/event-search-url";
import type { EventSort } from "../lib/event-search-params";
import type { KiwiCueEvent } from "../lib/events";
import type { EventWindow } from "../lib/event-window";
import type { Language } from "./language-provider";

type SearchState = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort: EventSort;
};

const copy = {
  en: {
    start: "Start here",
    startBody: "A strong mix of timing, useful detail and trusted sources.",
    moods: "Explore by mood",
    categories: "Explore by category",
    more: "More dates",
    free: "Free to enter",
    picks: "Verified picks",
    weekend: "This weekend",
    result: (keyword: string | null) => keyword ? `Results for “${keyword}”` : "Filtered events",
  },
  zh: {
    start: "从这里开始",
    startBody: "结合时间、实用信息和可靠来源的精选入口。",
    moods: "按心情探索",
    categories: "按类型探索",
    more: "更多日期",
    free: "免费入场",
    picks: "已核实精选",
    weekend: "本周末",
    result: (keyword: string | null) => keyword ? `“${keyword}”的搜索结果` : "筛选结果",
  },
} as const;

const moods: Array<{ id: string; en: string; zh: string; category: EventCategory; window: EventWindow }> = [
  { id: "live", en: "Live music", zh: "现场音乐", category: "concerts", window: "30d" },
  { id: "stage", en: "A stage night", zh: "剧场之夜", category: "theatre", window: "30d" },
  { id: "market", en: "Market morning", zh: "周末市集", category: "markets", window: "weekend" },
  { id: "festival", en: "Festival day", zh: "节庆一日", category: "festivals", window: "30d" },
  { id: "match", en: "Match day", zh: "比赛日", category: "sports", window: "30d" },
];

const categoryLabels: Record<Language, Record<EventCategory, string>> = {
  en: { concerts: "Concerts", theatre: "Theatre", markets: "Markets", festivals: "Festivals", sports: "Sports" },
  zh: { concerts: "演唱会", theatre: "话剧演出", markets: "市集", festivals: "节日活动", sports: "体育赛事" },
};

function DateGroup({ date, events, language, offset = 0 }: {
  date: string;
  events: KiwiCueEvent[];
  language: Language;
  offset?: number;
}) {
  const value = new Date(`${date}T12:00:00+12:00`);
  const locale = language === "zh" ? "zh-CN" : "en-NZ";
  return (
    <section className="event-date-group" aria-label={value.toLocaleDateString(locale, { dateStyle: "full" })}>
      <div className="event-date-marker" aria-hidden="true">
        <span>{value.toLocaleDateString(locale, { weekday: "short" }).toUpperCase()}</span>
        <strong>{value.toLocaleDateString(locale, { day: "2-digit" })}</strong>
        <span>{value.toLocaleDateString(locale, { month: "short" }).toUpperCase()}</span>
      </div>
      <ol className="event-date-list">
        {events.map((event, index) => (
          <li key={event.id}><EventCard event={event} index={offset + index} language={language} variant="row" /></li>
        ))}
      </ol>
    </section>
  );
}

function addGroupOffsets(groups: ReturnType<typeof groupEventsByAucklandDate>, start = 0) {
  return groups.map((group, index) => ({
    group,
    offset: start + groups.slice(0, index).reduce((total, item) => total + item.events.length, 0),
  }));
}

export function EventDiscoveryView({ events, language, now = new Date() }: { events: KiwiCueEvent[]; language: Language; now?: Date }) {
  const content = copy[language];
  const model = buildEventDiscovery(events, now);
  const lead = model.lead;
  const used = new Set(lead.map(({ id }) => id));
  const take = (candidates: KiwiCueEvent[]) => candidates.filter(({ id }) => !used.has(id)).slice(0, 3);
  const free = take(model.free);
  free.forEach(({ id }) => used.add(id));
  const picks = take(model.picks);
  picks.forEach(({ id }) => used.add(id));
  const weekend = take(model.weekend);
  weekend.forEach(({ id }) => used.add(id));
  const remaining = groupEventsByAucklandDate(
    model.dateGroups.flatMap(({ events: groupEvents }) => groupEvents).filter(({ id }) => !used.has(id)),
  );
  const freeOffset = lead.length;
  const picksOffset = freeOffset + free.length;
  const weekendOffset = picksOffset + picks.length;
  const remainingWithOffsets = addGroupOffsets(remaining, weekendOffset + weekend.length);
  const collection = (title: string, collectionEvents: KiwiCueEvent[], offset: number) => collectionEvents.length > 0 && (
    <section className="event-discovery-section event-evidence-collection">
      <h2>{title}</h2>
      <ol className="event-collection-list">
        {collectionEvents.map((event, index) => <li key={event.id}><EventCard event={event} index={offset + index} language={language} variant="row" /></li>)}
      </ol>
    </section>
  );
  return (
    <div className="event-discovery-view">
      <section className="event-discovery-section event-start-here" aria-labelledby="start-here-title">
        <header><p className="eyebrow">01 / CURATED</p><h2 id="start-here-title">{content.start}</h2><p>{content.startBody}</p></header>
        <ol className="event-lead-story">
          {lead.map((event, index) => <li key={event.id}><EventCard event={event} index={index} language={language} variant={index === 0 ? "lead" : "supporting"} /></li>)}
        </ol>
      </section>
      {collection(content.free, free, freeOffset)}
      {collection(content.picks, picks, picksOffset)}
      {collection(content.weekend, weekend, weekendOffset)}
      <section className="event-discovery-section" aria-labelledby="mood-title">
        <h2 id="mood-title">{content.moods}</h2>
        <nav className="event-mood-links" aria-label={content.moods}>
          {moods.map((mood) => <Link key={mood.id} href={eventSearchHref({ window: mood.window, category: mood.category, keyword: null, venueId: null, sort: "recommended" })}>{mood[language]}</Link>)}
        </nav>
      </section>
      <section className="event-discovery-section" aria-labelledby="category-discovery-title">
        <h2 id="category-discovery-title">{content.categories}</h2>
        <nav className="event-category-links" aria-label={content.categories}>
          {EVENT_CATEGORIES.map((category) => <Link key={category} href={eventSearchHref({ window: "all", category, keyword: null, venueId: null, sort: "recommended" })}>{categoryLabels[language][category]}</Link>)}
        </nav>
      </section>
      {remaining.length > 0 && <section className="event-discovery-section"><h2>{content.more}</h2>{remainingWithOffsets.map(({ group, offset }) => (
        <DateGroup key={group.date} {...group} language={language} offset={offset} />
      ))}</section>}
    </div>
  );
}

export function EventResultsView({ events, language, state }: { events: KiwiCueEvent[]; language: Language; state: SearchState }) {
  const ordered = sortDiscoveryEvents(events, state.sort);
  const groups = groupEventsByAucklandDate(ordered);
  const groupsWithOffsets = addGroupOffsets(groups);
  return (
    <div className="event-results-view">
      <header className="event-results-heading"><p className="eyebrow">SEARCH / AUCKLAND</p><h2>{copy[language].result(state.keyword)}</h2></header>
      {groupsWithOffsets.map(({ group, offset }) => (
        <DateGroup key={group.date} {...group} language={language} offset={offset} />
      ))}
    </div>
  );
}
