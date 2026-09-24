"use client";

import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent } from "../lib/events";
import { useLanguage } from "./language-provider";

export function PublicCollectionContent({ events }: { events: KiwiCueEvent[] }) {
  const { language } = useLanguage();
  if (events.length === 0) {
    return <p>{language === "zh" ? "这个清单还没有活动。" : "No events in this collection yet."}</p>;
  }
  return <div className="collection-event-grid">{events.map((event, index) =>
    <EventCard key={event.id} event={event} index={index} language={language} />
  )}</div>;
}
