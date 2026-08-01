import type { Language } from "../../components/language-provider";
import type { KiwiCueEvent } from "../../lib/events";

const copy = {
  en: {
    timePending: "Time to be confirmed",
    venuePending: "Auckland venue to be confirmed",
    details: "Official details",
    open: (name: string) => `Open ${name} official details`,
    position: (position: number) => `Chronological position ${position}`,
    status: {
      onsale: "On sale",
      offsale: "Off sale",
      cancelled: "Cancelled",
      postponed: "Postponed",
      rescheduled: "Rescheduled",
    },
  },
  zh: {
    timePending: "时间待定",
    venuePending: "奥克兰场馆待确认",
    details: "官方详情",
    open: (name: string) => `打开 ${name} 官方详情`,
    position: (position: number) => `按时间排序第 ${position} 个`,
    status: {
      onsale: "售票中",
      offsale: "停止售票",
      cancelled: "已取消",
      postponed: "已延期",
      rescheduled: "已改期",
    },
  },
} as const;

function formatEventDate(localDate: string, language: Language): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (language === "zh") {
    const weekday = new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
    return `${month}月${day}日${weekday}`;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatEventTime(localTime: string | null, language: Language): string {
  if (!localTime) return copy[language].timePending;
  const [hour, minute] = localTime.split(":").map(Number);
  if (language === "zh") {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute))).toLowerCase();
}

function formatStatus(status: string, language: Language): string {
  const known = copy[language].status as Record<string, string>;
  const label = known[status];
  if (label) return label;
  const normalized = status.replaceAll("_", " ");
  return language === "en"
    ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : normalized;
}

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
      <a
        className="portal-event-link"
        href={event.url}
        target="_blank"
        rel="noreferrer noopener"
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
            <span>{formatStatus(event.status, language)}</span>
          </div>
          <span className="portal-event-cta">
            {content.details}<span aria-hidden="true">↗</span>
          </span>
        </div>
      </a>
    </article>
  );
}
