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
    sessions: (count: number, last: string) => `${count} sessions · until ${last}`,
    allSessions: (count: number) => `All ${count} sessions`,
    session: (name: string, when: string) => `${name}, ${when}`,
  },
  zh: {
    venuePending: "奥克兰场馆待确认",
    details: "查看详情",
    open: (name: string) => `查看 ${name} 详情`,
    sessions: (count: number, last: string) => `共 ${count} 场 · 至 ${last}`,
    allSessions: (count: number) => `查看全部 ${count} 场`,
    session: (name: string, when: string) => `${name}，${when}`,
  },
} as const;

function whenLabel(event: KiwiCueEvent, language: Language): string {
  return `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
}

/** Every session of a grouped show; each links to its own page, where tickets for that date are sold. */
function SeriesSessions({ sessions, displayName, language }: { sessions: KiwiCueEvent[]; displayName: string; language: Language }) {
  const content = copy[language];
  return (
    <details className="event-series-sessions">
      <summary>{content.allSessions(sessions.length)}</summary>
      <ol>
        {sessions.map((session) => (
          <li key={session.id}>
            <Link href={`/events/${encodeURIComponent(session.id)}`} aria-label={content.session(displayName, whenLabel(session, language))}>
              <time dateTime={session.start.dateTime ?? session.start.localDate}>{whenLabel(session, language)}</time>
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function EventCard({ event, index, language, rankLabel, variant, sessions }: {
  event: KiwiCueEvent;
  index: number;
  language: Language;
  rankLabel?: (position: number) => string;
  variant?: "lead" | "supporting" | "row" | "standard";
  /** All sessions of this show when it runs more than once; the card itself shows the next one. */
  sessions?: KiwiCueEvent[];
}) {
  const content = copy[language];
  const displayName = eventDisplayName(event, language);
  const safeEventId = event.id.replace(/[^A-Za-z0-9_-]/g, "-");
  const titleId = `event-title-${index}-${safeEventId}`;
  const dateTime = whenLabel(event, language);
  const series = sessions && sessions.length > 1 ? sessions : null;
  const venue = event.venue
    ? `${event.venue.name} · ${event.venue.city}`
    : content.venuePending;
  const layout = variant ?? (index === 0 ? "feature" : "standard");
  const preview = language === "zh"
    ? event.localization?.zh?.previewSummary ?? event.editorialPreview?.summary
    : event.editorialPreview?.summary;

  return (
    <article className="portal-event-card" data-layout={layout} aria-labelledby={titleId}>
      <Link
        className="portal-event-link"
        href={`/events/${encodeURIComponent(event.id)}`}
        aria-label={content.open(displayName)}
      >
        <EventEditorialPreviewMedia event={event} language={language} placement="card" showSummaryInFallback={variant !== "row" || !preview} />
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
          {series && <p className="portal-event-series">{content.sessions(series.length, formatEventDate(series[series.length - 1].start.localDate, language))}</p>}
          <p className="portal-event-venue">{venue}</p>
          {variant === "row" && preview && <p className="portal-event-preview">{preview}</p>}
          <div className="portal-event-meta">
            <span>{formatEventCategory(event.category, language)}</span>
            <span>{formatEventStatusForDisplay(event, language)}</span>
          </div>
        </div>
        <span className="portal-event-cta">
          {content.details}<span aria-hidden="true">↗</span>
        </span>
      </Link>
      {series && <SeriesSessions sessions={series} displayName={displayName} language={language} />}
      <BookmarkButton event={event} language={language} />
    </article>
  );
}
