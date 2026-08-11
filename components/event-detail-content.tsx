"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEventDate, formatEventStatus, formatEventTime } from "../lib/event-display";
import type { KiwiCueEventDetail } from "../lib/events";
import { BookmarkButton } from "./bookmark-button";
import { DistancePanel } from "./distance-panel";
import { EventMap } from "./event-map";
import { EventImage } from "./event-image";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; event: KiwiCueEventDetail }
  | { status: "not-found" }
  | { status: "error" };

export class EventDetailRequestError extends Error {
  constructor(public readonly status: number) {
    super(`EVENT_DETAIL_${status}`);
    this.name = "EventDetailRequestError";
  }
}

export async function requestEventDetailFromApi(eventId: string): Promise<KiwiCueEventDetail> {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json() as { event?: KiwiCueEventDetail };
  if (!response.ok || !body.event || body.event.id !== eventId) {
    throw new EventDetailRequestError(response.status);
  }
  return body.event;
}

const copy = {
  en: {
    loading: "Loading event details",
    back: "Back to Auckland events",
    eyebrow: "Auckland event details",
    bookingTitle: "How to book",
    bookingSteps: [
      "Review the event time, status, and venue on this page.",
      "Choose Continue to official booking below.",
      "Select an available option and complete booking or payment on the official website.",
    ],
    information: "Event information",
    noDescription: "No additional organiser description is available yet.",
    note: "Organiser note",
    venue: "Venue and map",
    addressUnavailable: "Street address is not available yet.",
    coordinatesUnavailable: "Map and distance are unavailable because this venue has no coordinates yet.",
    booking: "Continue to official booking",
    officialWebsite: "Open official event website",
    source: "Availability, fees, entry rules, and final details remain with the official event website.",
    notFound: "Event not found",
    notFoundBody: "This event may have been removed or its official listing may have changed.",
    browse: "Browse Auckland events",
    error: "Event details are temporarily unavailable",
    errorBody: "The official event feed could not be refreshed. Try again in a moment.",
    retry: "Retry event details",
    footer: "Official information, one useful step at a time.",
  },
  zh: {
    loading: "正在加载活动详情",
    back: "返回奥克兰活动",
    eyebrow: "奥克兰活动详情",
    bookingTitle: "预约或购票方式",
    bookingSteps: [
      "先确认本页显示的活动时间、状态和场馆。",
      "点击下方“前往官网预约或购票”。",
      "在官方网站选择仍可用的场次或票种，并完成预约或付款。",
    ],
    information: "活动说明",
    noDescription: "主办方暂未提供更多活动介绍。",
    note: "主办方提示",
    venue: "场馆与地图",
    addressUnavailable: "场馆暂未提供街道地址。",
    coordinatesUnavailable: "该场馆暂未提供坐标，因此无法显示地图和距离。",
    booking: "前往官网预约或购票",
    officialWebsite: "打开官方活动页面",
    source: "余票、费用、入场规则和最终活动详情均以官方网站为准。",
    notFound: "没有找到这个活动",
    notFoundBody: "该活动可能已下架，或官方活动信息已经改变。",
    browse: "浏览奥克兰活动",
    error: "暂时无法加载活动详情",
    errorBody: "官方活动信息刷新失败，请稍后重试。",
    retry: "重新加载活动详情",
    footer: "官方信息，一步找到真正有用的内容。",
  },
} as const;

export function EventDetailContent({
  eventId,
  requestEventDetail = requestEventDetailFromApi,
}: {
  eventId: string;
  requestEventDetail?: (eventId: string) => Promise<KiwiCueEventDetail>;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    requestEventDetail(eventId)
      .then((event) => {
        if (active) setState({ status: "ready", event });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState(error instanceof EventDetailRequestError && error.status === 404
          ? { status: "not-found" }
          : { status: "error" });
      });
    return () => { active = false; };
  }, [attempt, eventId, requestEventDetail]);

  function shell(body: React.ReactNode) {
    return (
      <main className="event-detail-page">
        <PortalHeader skipTarget="event-detail" currentPage="events" />
        {body}
        <footer className="portal-footer">
          <span>KiwiCue / 纽村小报</span>
          <span>{content.footer}</span>
        </footer>
      </main>
    );
  }

  if (state.status === "loading") {
    return shell(
      <section id="event-detail" className="event-state event-loading" role="status" aria-busy="true">
        <p>{content.loading}</p>
        <div className="event-detail-loading-skeleton" aria-hidden="true">
          <span className="event-detail-skeleton-title" />
          <span className="event-detail-skeleton-line" />
          <span className="event-detail-skeleton-actions" />
          <span className="event-detail-skeleton-media" />
        </div>
      </section>,
    );
  }

  if (state.status === "not-found") {
    return shell(
      <section id="event-detail" className="event-state" role="alert">
        <span className="state-code" aria-hidden="true">404</span>
        <h1>{content.notFound}</h1>
        <p>{content.notFoundBody}</p>
        <Link className="portal-empty-action" href="/events">{content.browse}</Link>
      </section>,
    );
  }

  if (state.status === "error") {
    return shell(
      <section id="event-detail" className="event-state event-error" role="alert">
        <span className="state-code" aria-hidden="true">DETAIL / RETRY</span>
        <h1>{content.error}</h1>
        <p>{content.errorBody}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
          aria-label={content.retry}
        >
          {content.retry} <span aria-hidden="true">↻</span>
        </button>
      </section>,
    );
  }

  const event = state.event;
  const dateTime = `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
  const venue = event.venue;

  return shell(
    <article id="event-detail" className="event-detail-shell" aria-labelledby="event-detail-title">
      <div className="event-detail-primary">
        <Link className="event-detail-back" href="/events">← {content.back}</Link>
        <header className="event-detail-heading">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="event-detail-title">{event.name}</h1>
          <p className="event-detail-date">
            <time dateTime={event.start.dateTime ?? event.start.localDate}>{dateTime}</time>
          </p>
          <p className="event-detail-venue-summary">
            {venue?.name ?? content.addressUnavailable}
            {venue?.city ? ` · ${venue.city}` : ""}
          </p>
          <div className="event-detail-tags">
            <span>{event.category}</span>
            <span>{formatEventStatus(event.status, language)}</span>
          </div>
          <div className="event-detail-actions">
            <a
              className="event-booking-inline"
              href={event.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {content.booking}<span aria-hidden="true"> ↗</span>
            </a>
            <BookmarkButton event={event} language={language} placement="detail" />
          </div>
        </header>
        <div className="event-detail-media">
          <EventImage src={event.imageUrl} alt="" fallback="AKL" loading="eager" />
        </div>

        <section className="event-detail-section" aria-labelledby="booking-title">
          <h2 id="booking-title">{content.bookingTitle}</h2>
          <ol>{content.bookingSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>

        <section className="event-detail-section" aria-labelledby="information-title">
          <h2 id="information-title">{content.information}</h2>
          <p>{event.description ?? content.noDescription}</p>
          {event.note && (
            <aside className="event-organiser-note">
              <h3>{content.note}</h3>
              <p>{event.note}</p>
            </aside>
          )}
        </section>
      </div>

      <aside className="event-detail-venue" aria-labelledby="venue-title">
        <h2 id="venue-title">{content.venue}</h2>
        <div className="event-address">
          <strong>{venue?.name ?? content.addressUnavailable}</strong>
          <span>{venue?.address ?? content.addressUnavailable}</span>
          {venue && <span>{[venue.city, venue.postalCode].filter(Boolean).join(" ")}</span>}
        </div>
        {venue?.coordinates ? (
          <>
            <EventMap coordinates={venue.coordinates} language={language} venueName={venue.name} />
            <DistancePanel coordinates={venue.coordinates} language={language} />
          </>
        ) : (
          <p className="event-map-unavailable">{content.coordinatesUnavailable}</p>
        )}
        <a
          className="event-booking-action"
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {content.officialWebsite}<span aria-hidden="true"> ↗</span>
        </a>
        <p className="event-source-note">{content.source}</p>
      </aside>
    </article>,
  );
}
