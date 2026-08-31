import Link from "next/link";
import { BookmarkButton } from "../../components/bookmark-button";
import { EventEditorialPreviewMedia } from "../../components/event-editorial-preview";
import type { Language } from "../../components/language-provider";
import {
  eventDisplayName,
  formatEventCategory,
  formatEventDate,
  formatEventStatusForDisplay,
  formatEventTime,
} from "../../lib/event-display";
import type { KiwiCueEvent } from "../../lib/events";

const copy = {
  en: {
    venuePending: "Auckland venue to be confirmed",
    details: "View details",
    open: (name: string) => `View ${name} details`,
  },
  zh: {
    venuePending: "奥克兰场馆待确认",
    details: "查看详情",
    open: (name: string) => `查看 ${name} 详情`,
  },
} as const;

export function EventCard({ event, index, language, rankLabel, variant }: {
  event: KiwiCueEvent;
  index: number;
  language: Language;
  rankLabel?: (position: number) => string;
  variant?: "lead" | "supporting" | "row" | "standard";
}) {
  const content = copy[language];
  const displayName = eventDisplayName(event, language);
  const safeEventId = event.id.replace(/[^A-Za-z0-9_-]/g, "-");
  const titleId = `event-title-${index}-${safeEventId}`;
  const dateTime = `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
  const venue = event.venue
    ? `${event.venue.name} · ${event.venue.city}`
    : content.venuePending;
  const layout = variant ?? (index === 0 ? "feature" : "standard");

  return (
    <article className="portal-event-card" data-layout={layout} aria-labelledby={titleId}>
      <Link
        className="portal-event-link"
        href={`/events/${encodeURIComponent(event.id)}`}
        aria-label={content.open(displayName)}
      >
        <div className="portal-event-body">
          <span
            className="portal-event-rank"
            aria-hidden={rankLabel ? undefined : true}
            aria-label={rankLabel?.(index + 1)}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h2 id={titleId}>{displayName}</h2>
          <p className="portal-event-date">
            <time dateTime={event.start.dateTime ?? event.start.localDate}>{dateTime}</time>
          </p>
          <p className="portal-event-venue">{venue}</p>
          <div className="portal-event-meta">
            <span>{formatEventCategory(event.category, language)}</span>
            <span>{formatEventStatusForDisplay(event, language)}</span>
          </div>
        </div>
        <EventEditorialPreviewMedia event={event} language={language} placement="card" />
        <span className="portal-event-cta">
          {content.details}<span aria-hidden="true">↗</span>
        </span>
      </Link>
      <BookmarkButton event={event} language={language} />
    </article>
  );
}
