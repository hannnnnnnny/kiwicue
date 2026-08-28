"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventCard } from "../app/events/event-card";
import {
  eventDisplayDescription,
  eventDisplayName,
  eventDisplayNote,
  formatEventCategory,
  formatEventDate,
  formatEventStatus,
  formatEventTime,
  formatVerifiedDate,
} from "../lib/event-display";
import type { KiwiCueEvent, KiwiCueEventDetail } from "../lib/events";
import { BookmarkButton } from "./bookmark-button";
import { DistancePanel } from "./distance-panel";
import { EventEditorialPreviewMedia } from "./event-editorial-preview";
import { EventMap } from "./event-map";
import { useLanguage } from "./language-provider";
import { MarketPastHighlights } from "./market-past-highlights";
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
    organiser: "Organiser",
    related: "You may also like",
    note: "Organiser note",
    venue: "Venue and map",
    addressUnavailable: "Street address is not available yet.",
    coordinatesUnavailable: "Map and distance are unavailable because this venue has no coordinates yet.",
    booking: "Continue to official booking",
    officialWebsite: "Open official event website",
    source: "Availability, entry rules, and final details remain with the official event website.",
    notFound: "Event not found",
    notFoundBody: "This event may have been removed or its official listing may have changed.",
    browse: "Browse Auckland events",
    error: "Event details are temporarily unavailable",
    errorBody: "The official event feed could not be refreshed. Try again in a moment.",
    retry: "Retry event details",
    footer: "Official information, one useful step at a time.",
    marketBookingTitle: "Plan your visit",
    marketBookingSteps: [
      "Check the next market date, opening time, and venue shown here.",
      "Open the official market website to confirm any last-minute change.",
      "Allow extra travel time and check public-holiday notices before leaving.",
    ],
    marketBooking: "Check official schedule",
    marketSource: "Official schedule source",
    verified: (date: string) => `Schedule last checked ${date}`,
    marketSourceNote: "Market times can change. Confirm the latest schedule and access details on the official market website before travelling.",
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
    organiser: "主办方",
    related: "你可能也喜欢",
    note: "主办方提示",
    venue: "场馆与地图",
    addressUnavailable: "场馆暂未提供街道地址。",
    coordinatesUnavailable: "该场馆暂未提供坐标，因此无法显示地图和距离。",
    booking: "前往官网预约或购票",
    officialWebsite: "打开官方活动页面",
    source: "余票、入场规则和最终活动详情均以官方网站为准。",
    notFound: "没有找到这个活动",
    notFoundBody: "该活动可能已下架，或官方活动信息已经改变。",
    browse: "浏览奥克兰活动",
    error: "暂时无法加载活动详情",
    errorBody: "官方活动信息刷新失败，请稍后重试。",
    retry: "重新加载活动详情",
    footer: "官方信息，一步找到真正有用的内容。",
    marketBookingTitle: "出发前确认",
    marketBookingSteps: [
      "先确认本页显示的下次市集日期、时间和地点。",
      "打开市集官网，确认有没有临时变更。",
      "出发前预留交通时间，并查看公共假期通知。",
    ],
    marketBooking: "查看官方最新安排",
    marketSource: "官方日程来源",
    verified: (date: string) => `日程核实日期：${date}`,
    marketSourceNote: "市集时间可能临时调整；出发前请在市集官网确认最新日程和入场信息。",
  },
} as const;

function formatAdmission(event: KiwiCueEventDetail, language: "en" | "zh"): string | null {
  if (!event.admission || event.admission.kind === "unknown") return null;
  if (event.admission.kind === "free") return language === "zh" ? "免费" : "Free";
  const amount = (value: number) => `NZ$${new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 2 }).format(value)}`;
  return event.admission.min === event.admission.max
    ? amount(event.admission.min)
    : `${amount(event.admission.min)}–${amount(event.admission.max)}`;
}

export function EventDetailContent({
  eventId,
  initialEvent,
  relatedEvents = [],
  requestEventDetail = requestEventDetailFromApi,
}: {
  eventId?: string;
  initialEvent?: KiwiCueEventDetail;
  relatedEvents?: KiwiCueEvent[];
  requestEventDetail?: (eventId: string) => Promise<KiwiCueEventDetail>;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>(initialEvent
    ? { status: "ready", event: initialEvent }
    : { status: "loading" });

  useEffect(() => {
    if (initialEvent) {
      setState({ status: "ready", event: initialEvent });
      return;
    }
    if (!eventId) {
      setState({ status: "not-found" });
      return;
    }
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
  }, [attempt, eventId, initialEvent, requestEventDetail]);

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
  const isCuratedMarket = Boolean(event.source);
  const displayName = eventDisplayName(event, language);
  const description = eventDisplayDescription(event, language);
  const note = eventDisplayNote(event, language);
  const officialUrl = event.source?.url ?? event.url;
  const bookingTitle = isCuratedMarket ? content.marketBookingTitle : content.bookingTitle;
  const bookingSteps = isCuratedMarket ? content.marketBookingSteps : content.bookingSteps;
  const bookingLabel = isCuratedMarket ? content.marketBooking : content.booking;
  const dateTime = `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
  const venue = event.venue;
  const admission = formatAdmission(event, language);

  return shell(
    <article id="event-detail" className="event-detail-shell" aria-labelledby="event-detail-title">
      <div className="event-detail-primary">
        <Link className="event-detail-back" href="/events">← {content.back}</Link>
        <div className="event-detail-hero">
          <header className="event-detail-heading">
            <p className="eyebrow">{content.eyebrow}</p>
            <h1 className="editorial-display" id="event-detail-title">{displayName}</h1>
            <div className="event-detail-facts">
              <p className="event-detail-date">
                <time dateTime={event.start.dateTime ?? event.start.localDate}>{dateTime}</time>
              </p>
              <p className="event-detail-venue-summary">
                {venue?.name ?? content.addressUnavailable}
                {venue?.city ? ` · ${venue.city}` : ""}
              </p>
              {admission && <p className="event-detail-admission">{admission}</p>}
              <div className="event-detail-tags">
                <span>{formatEventCategory(event.category, language)}</span>
                <span>{formatEventStatus(event.status, language)}</span>
              </div>
            </div>
            <div className="event-detail-actions">
              <a
                className="event-booking-inline"
                href={officialUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {bookingLabel}<span aria-hidden="true"> ↗</span>
              </a>
              <BookmarkButton event={event} language={language} placement="detail" />
            </div>
          </header>
          <EventEditorialPreviewMedia event={event} language={language} placement="detail" />
        </div>

        <section className="event-detail-section" aria-labelledby="booking-title">
          <h2 id="booking-title">{bookingTitle}</h2>
          <ol>{bookingSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>

        {isCuratedMarket && (
          <MarketPastHighlights event={event} language={language} />
        )}

        {(description || note) && (
          <section className="event-detail-section" aria-labelledby="information-title">
            <h2 id="information-title">{content.information}</h2>
            {description && <p>{description}</p>}
            {note && (
              <aside className="event-organiser-note">
                <h3>{content.note}</h3>
                <p>{note}</p>
              </aside>
            )}
          </section>
        )}

        {event.organiserName && (
          <section className="event-detail-section" aria-labelledby="organiser-title">
            <h2 id="organiser-title">{content.organiser}</h2>
            <p>{event.organiserName}</p>
          </section>
        )}

        {relatedEvents.length > 0 && (
          <section className="event-detail-related" aria-labelledby="related-events-title">
            <h2 id="related-events-title">{content.related}</h2>
            <ol>
              {relatedEvents.map((relatedEvent, index) => (
                <li key={relatedEvent.id}>
                  <EventCard event={relatedEvent} index={index} language={language} variant="row" />
                </li>
              ))}
            </ol>
          </section>
        )}
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
          href={officialUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {content.officialWebsite}<span aria-hidden="true"> ↗</span>
        </a>
        {event.source && (
          <div className="event-source-verification">
            <span>{content.marketSource}</span>
            <strong className="event-source-name">{event.source.name}</strong>
            <span>{content.verified(formatVerifiedDate(event.source.verifiedAt, language))}</span>
          </div>
        )}
        <p className="event-source-note">
          {isCuratedMarket ? content.marketSourceNote : content.source}
        </p>
      </aside>
    </article>,
  );
}
