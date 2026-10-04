"use client";

import { useState } from "react";
import { EventCard } from "../app/events/event-card";
import { distanceKm, formatDistanceKm, isValidCoordinates } from "../lib/distance";
import { eventDisplayName } from "../lib/event-display";
import type { EventCoordinates, KiwiCueEvent } from "../lib/events";
import { groupEventSeries } from "../lib/event-series";
import { EventMap } from "./event-map";
import type { Language } from "./language-provider";

const copy = {
  en: { choose: "Choose an event on the map", location: "Sort by my distance", checking: "Finding your location…", privacy: "Location stays on this device. Distances are straight-line estimates.", unavailable: "Location unavailable. You can still explore Auckland venues.", none: "None of these events has a mapped venue." },
  zh: { choose: "选择地图中的活动", location: "按离我距离排序", checking: "正在定位…", privacy: "位置只在当前设备使用，距离为直线估算。", unavailable: "暂时无法定位，仍可浏览奥克兰场馆。", none: "这些活动都没有可显示的场馆位置。" },
} as const;

function located(events: KiwiCueEvent[], position?: EventCoordinates): KiwiCueEvent[] {
  const mapped = events.filter((event) => event.venue?.coordinates && isValidCoordinates(event.venue.coordinates));
  if (!position) return mapped;
  return [...mapped].sort((a, b) => distanceKm(position, a.venue!.coordinates!) - distanceKm(position, b.venue!.coordinates!));
}

function useLocation() {
  const [position, setPosition] = useState<EventCoordinates>();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  function locate() {
    if (!navigator.geolocation) { setState("error"); return; }
    setState("loading");
    navigator.geolocation.getCurrentPosition((value) => {
      const coordinates = { latitude: value.coords.latitude, longitude: value.coords.longitude };
      if (!isValidCoordinates(coordinates)) { setState("error"); return; }
      setPosition(coordinates); setState("idle");
    }, () => setState("error"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  return { position, state, locate };
}

/** The current list on a map: pick an event to see its venue, or sort the list by distance from you. */
export function EventMapView({ events, language }: { events: KiwiCueEvent[]; language: Language }) {
  const content = copy[language];
  const { position, state, locate } = useLocation();
  const [selectedId, setSelectedId] = useState<string>();
  const shown = located(events, position);
  const selected = shown.find((event) => event.id === selectedId) ?? shown[0];
  if (!selected?.venue?.coordinates) return <p className="discovery-empty" role="status">{content.none}</p>;
  return (
    <section className="discovery-nearby" id="map">
      <button type="button" onClick={locate} disabled={state === "loading"}>{state === "loading" ? content.checking : content.location}</button>
      <p>{content.privacy}</p>
      {state === "error" ? <p role="status">{content.unavailable}</p> : null}
      <div className="discovery-venue-map">
        <label htmlFor="discovery-map-event">{content.choose}</label>
        <select id="discovery-map-event" value={selected.id} onChange={(change) => setSelectedId(change.target.value)}>
          {shown.map((event) => <option key={event.id} value={event.id}>{eventDisplayName(event, language)} · {event.venue?.name}</option>)}
        </select>
        <EventMap coordinates={selected.venue.coordinates} venueName={selected.venue.name} language={language} />
      </div>
      <ol className="discovery-feed">
        {groupEventSeries(shown).map(({ key, lead, events: sessions }, index) => (
          <li key={key}>
            <EventCard event={lead} sessions={sessions} index={index} language={language} variant="row" />
            {position && lead.venue?.coordinates ? <p className="discovery-distance">{formatDistanceKm(distanceKm(position, lead.venue.coordinates), language)}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
