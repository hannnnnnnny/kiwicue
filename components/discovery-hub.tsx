"use client";

import Link from "next/link";
import { useState } from "react";
import { EventCard } from "../app/events/event-card";
import { selectCollectionEvents, type DiscoveryCollection } from "../lib/discovery-collections";
import { eventDisplayName, formatEventCategory, formatEventDate, formatEventTime } from "../lib/event-display";
import type { KiwiCueEvent } from "../lib/events";
import { eventSearchHref, type EventSearchState } from "../lib/event-search-url";
import { groupEventSeries, groupSeriesBySection, type EventSectionId, type EventSeries } from "../lib/event-series";
import { BookmarkButton } from "./bookmark-button";
import { DiscoveryIcon } from "./discovery-icon";
import { EventImage } from "./event-image";
import { EventStack } from "./event-stack";
import type { Language } from "./language-provider";

const labels = {
  en: { all: "Events in Auckland", tonight: "Tonight", weekend: "This weekend", free: "Free", music: "Live music", surprise: "Surprise me", empty: "No upcoming events in the loaded selection. Load more below.", scope: "These previews use the events loaded so far. More may be available below." },
  zh: { all: "奥克兰活动", tonight: "今晚", weekend: "本周末", free: "免费", music: "现场音乐", surprise: "给我惊喜", empty: "已加载活动中暂时没有内容，可以在下方加载更多。", scope: "这些预览来自当前已加载的活动，下方还可以继续加载。" },
};

const SECTION_PREVIEW = 6;
const sectionLabels: Record<Language, Record<EventSectionId, string>> = {
  en: { music: "Music", theatre: "Arts & theatre", family: "Family & kids", sports: "Sports", other: "Tours, experiences & more" },
  zh: { music: "音乐现场", theatre: "戏剧艺术", family: "亲子家庭", sports: "体育赛事", other: "导览体验及其他" },
};

function SeriesFeed({ series, language, offset = 0 }: { series: EventSeries[]; language: Language; offset?: number }) {
  return <ol className="discovery-feed">{series.map(({ key, lead, events }, index) => <li key={key}>
    <EventCard event={lead} sessions={events} index={offset + index} language={language} variant="row" />
  </li>)}</ol>;
}

/** The default feed, split by type so one busy category cannot crowd out the rest. */
function SectionedFeed({ series, language }: { series: EventSeries[]; language: Language }) {
  const [expanded, setExpanded] = useState<ReadonlySet<EventSectionId>>(new Set());
  const sections = groupSeriesBySection(series).map(({ id, series: all }) => ({
    id, all, visible: expanded.has(id) ? all : all.slice(0, SECTION_PREVIEW),
  }));
  // Card numbers keep counting across sections, so each card id stays unique on the page.
  const offsets = sections.map((_, index) => sections.slice(0, index).reduce((total, section) => total + section.visible.length, 0));
  return <>{sections.map(({ id, all: sectionSeries, visible }, index) => {
    const start = offsets[index];
    return <section key={id} className="discovery-category-section" aria-labelledby={`discovery-section-${id}`}>
      <header><h3 id={`discovery-section-${id}`}>{sectionLabels[language][id]}</h3><span>{sectionSeries.length}</span></header>
      <SeriesFeed series={visible} language={language} offset={start} />
      {visible.length < sectionSeries.length && <button type="button" className="discovery-section-more" onClick={() => setExpanded(new Set([...expanded, id]))}>
        {language === "zh" ? `显示全部 ${sectionSeries.length} 个` : `Show all ${sectionSeries.length}`}
      </button>}
    </section>;
  })}</>;
}

function FeaturedEvent({ event, language }: { event: KiwiCueEvent; language: Language }) {
  const name = eventDisplayName(event, language);
  return <article className="discovery-feature">
    <Link href={`/events/${encodeURIComponent(event.id)}`} aria-label={language === "zh" ? `打开精选活动：${name}` : `Explore featured event: ${name}`}>
      <EventImage src={event.editorialPreview?.image?.url ?? event.imageUrl} alt="" loading="eager" fallback={<span className="discovery-image-fallback">{formatEventCategory(event.category, language)}</span>} />
      <div className="discovery-feature-caption"><span className="discovery-category">{formatEventCategory(event.category, language)}</span><h2>{name}</h2><p>{formatEventDate(event.start.localDate, language)} · {formatEventTime(event.start.localTime, language)}</p>{event.venue && <p>{event.venue.name}</p>}<span className="discovery-feature-cta" aria-hidden="true">{language === "zh" ? "查看详情" : "View details"}<svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 1.5v9L10.5 6 3 1.5Z" fill="currentColor" /></svg></span></div>
    </Link>
    <BookmarkButton event={event} language={language} />
  </article>;
}

// The previews under the feed open the same list as the matching filters.
const STACKS = [
  { id: "tonight", change: { window: "tonight" } },
  { id: "weekend", change: { window: "weekend" } },
  { id: "free", change: { free: true } },
  { id: "music", change: { category: "concerts" } },
] as const satisfies readonly { id: DiscoveryCollection; change: Partial<EventSearchState> }[];

/** The unfiltered Discover page: a featured pick, the feed by type, and previews of popular filters. */
export function DiscoveryHub({ events, language, now = new Date() }: { events: KiwiCueEvent[]; language: Language; now?: Date }) {
  const [surpriseId, setSurpriseId] = useState<string>();
  const content = labels[language];
  const available = selectCollectionEvents(events, "all", now);
  const series = groupEventSeries(available);
  const feature = available.find(event => event.id === surpriseId) ?? available.find(event => event.imageUrl || event.editorialPreview?.image) ?? available[0];
  function surprise() {
    const candidates = series.map(({ lead }) => lead).filter(event => event.id !== feature?.id).slice(0, 20);
    if (!candidates.length) return;
    setSurpriseId(candidates[Math.floor(Math.random() * candidates.length)].id);
  }
  const base: EventSearchState = { window: "all", category: null, keyword: null, venueId: null };
  return <div className="discovery-hub">
    <section className="discovery-list-section">
      <header className="discovery-list-header">
        <h2>{content.all}</h2>
        <button type="button" className="discovery-surprise" onClick={surprise} disabled={available.length < 2}><DiscoveryIcon name="dice" />{content.surprise}</button>
      </header>
      {!available.length && <p className="discovery-empty" role="status">{content.empty}</p>}
      <SectionedFeed series={series} language={language} />
      <div className="discovery-feature-layout">{feature && <FeaturedEvent key={feature.id} event={feature} language={language} />}</div>
    </section>
    {available.length > 1 && <div className="discovery-stacks">{STACKS.map(({ id, change }) => <EventStack key={id} title={content[id]} events={selectCollectionEvents(events, id, now)} language={language} href={eventSearchHref({ ...base, ...change })} />)}</div>}
    <p className="discovery-scope">{content.scope} <Link href="/for-you">{language === "zh" ? "浏览本地精选" : "Browse local picks"}</Link></p>
  </div>;
}
