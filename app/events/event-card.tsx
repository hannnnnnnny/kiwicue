import Link from "next/link";
import type { Language } from "../../components/language-provider";
import { formatEventDate, formatEventStatus, formatEventTime } from "../../lib/event-display";
import type { KiwiCueEvent } from "../../lib/events";

const copy = {
  en: {
    venuePending: "Auckland venue to be confirmed",
    details: "View details",
    open: (name: string) => `View ${name} details`,
    position: (position: number) => `Chronological position ${position}`,
  },
  zh: {
    venuePending: "奥克兰场馆待确认",
    details: "查看详情",
    open: (name: string) => `查看 ${name} 详情`,
    position: (position: number) => `按时间排序第 ${position} 个`,
  },
} as const;

export function EventCard({ event, index, language }: {
  event: KiwiCueEvent;
  index: number;
  language: Language;
}) {
  const content = copy[language];
  const safeEventId = event.id.replace(/[^A-Za-z0-9_-]/g, "-");
  const titleId = `event-title-${index}-${safeEventId}`;
  const dateTime = `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
  const venue = event.venue
    ? `${event.venue.name} · ${event.venue.city}`
    : content.venuePending;

  return (
    <article className="portal-event-card" aria-labelledby={titleId}>
      <Link
        className="portal-event-link"
        href={`/events/${encodeURIComponent(event.id)}`}
        aria-label={content.open(event.name)}
      >
        <div className="portal-event-media">
          {event.imageUrl ? (
            // Ticketmaster image hosts vary by event; normalized upstream URLs remain decorative here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.imageUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="portal-event-fallback" aria-hidden="true">AKL</span>
          )}
          <span
            className="portal-event-rank"
            aria-label={content.position(index + 1)}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="portal-event-body">
          <p className="portal-event-date">{dateTime}</p>
          <h2 id={titleId}>{event.name}</h2>
          <p className="portal-event-venue">{venue}</p>
          <div className="portal-event-meta">
            <span>{event.category}</span>
            <span>{formatEventStatus(event.status, language)}</span>
          </div>
          <span className="portal-event-cta">
            {content.details}<span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
