"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  eventDisplayName,
  formatEventDate,
  formatEventTime,
} from "../lib/event-display";
import type { KiwiCueEvent } from "../lib/events";
import { EventImage } from "./event-image";
import type { Language } from "./language-provider";

type HomePreviewState =
  | { status: "loading" }
  | { status: "ready"; event: KiwiCueEvent }
  | { status: "empty" }
  | { status: "error" };

const copy = {
  en: {
    loading: "Loading a current Auckland event",
    feature: "Coming up in Auckland",
    details: "View event details",
    empty: "New Auckland listings are being added.",
    unavailable: "The live event preview is temporarily unavailable.",
    browse: "Browse all events",
    retry: "Retry event preview",
    imageAlt: (name: string) => `${name} event preview`,
    venuePending: "Auckland venue to be confirmed",
  },
  zh: {
    loading: "正在加载奥克兰近期活动",
    feature: "奥克兰近期活动",
    details: "查看活动详情",
    empty: "新的奥克兰活动正在陆续加入。",
    unavailable: "实时活动预览暂时不可用。",
    browse: "浏览全部活动",
    retry: "重新加载活动预览",
    imageAlt: (name: string) => `${name} 活动预览`,
    venuePending: "奥克兰场馆待确认",
  },
} as const;

function isEvent(value: unknown): value is KiwiCueEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  const start = event.start;
  return typeof event.id === "string"
    && typeof event.name === "string"
    && typeof event.url === "string"
    && (typeof event.imageUrl === "string" || event.imageUrl === null)
    && typeof event.status === "string"
    && typeof event.category === "string"
    && typeof start === "object"
    && start !== null
    && typeof (start as Record<string, unknown>).localDate === "string";
}

function firstEvent(value: unknown): KiwiCueEvent | null {
  if (typeof value !== "object" || value === null || !("events" in value)) return null;
  const events = (value as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0) return null;
  return isEvent(events[0]) ? events[0] : null;
}

export function HomeEventPreview({ language }: { language: Language }) {
  const content = copy[language];
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<HomePreviewState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    fetch("/api/events?window=30d&size=1", {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("HOME_EVENT_UNAVAILABLE");
        const body: unknown = await response.json();
        const event = firstEvent(body);
        setState(event ? { status: "ready", event } : { status: "empty" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  if (state.status === "loading") {
    return (
      <aside className="home-feature home-feature-loading" aria-label={content.loading} aria-busy="true">
        <span className="home-feature-skeleton home-feature-skeleton-media" aria-hidden="true" />
        <span className="home-feature-skeleton" aria-hidden="true" />
        <span className="home-feature-skeleton home-feature-skeleton-short" aria-hidden="true" />
      </aside>
    );
  }

  if (state.status === "empty" || state.status === "error") {
    return (
      <aside className="home-feature home-feature-message" role={state.status === "error" ? "alert" : "status"}>
        <p>{state.status === "error" ? content.unavailable : content.empty}</p>
        {state.status === "error" ? (
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>{content.retry}</button>
        ) : (
          <Link href="/events">{content.browse}<span aria-hidden="true"> ↗</span></Link>
        )}
      </aside>
    );
  }

  const { event } = state;
  const displayName = eventDisplayName(event, language);
  const dateTime = `${formatEventDate(event.start.localDate, language)} · ${formatEventTime(event.start.localTime, language)}`;
  const imageUrl = event.editorialPreview?.image?.url ?? event.imageUrl;

  return (
    <aside className="home-feature" aria-labelledby="home-feature-title">
      <Link href={`/events/${encodeURIComponent(event.id)}`} aria-label={`${content.details}: ${displayName}`}>
        <div className="home-feature-media">
          <EventImage
            src={imageUrl}
            alt={content.imageAlt(displayName)}
            loading="eager"
            fallback={<span className="home-feature-image-fallback" aria-hidden="true">KiwiCue</span>}
          />
        </div>
        <div className="home-feature-copy">
          <p>{content.feature}</p>
          <h2 id="home-feature-title">{displayName}</h2>
          <time dateTime={event.start.dateTime ?? event.start.localDate}>{dateTime}</time>
          <span>{event.venue?.name ?? content.venuePending}</span>
          <strong>{content.details}<span aria-hidden="true"> ↗</span></strong>
        </div>
      </Link>
    </aside>
  );
}
