"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EventCard } from "../app/events/event-card";
import { selectCollectionEvents, type DiscoveryCollection } from "../lib/discovery-collections";
import { isValidCoordinates, distanceKm, formatDistanceKm } from "../lib/distance";
import { eventDisplayName, formatEventCategory, formatEventDate, formatEventTime } from "../lib/event-display";
import type { EventCoordinates, KiwiCueEvent } from "../lib/events";
import { BookmarkButton } from "./bookmark-button";
import { DiscoveryIcon } from "./discovery-icon";
import { EventImage } from "./event-image";
import { EventMap } from "./event-map";
import { EventStack } from "./event-stack";
import type { Language } from "./language-provider";
import { navigateDiscovery, useDiscoveryCollection } from "./use-discovery-collection";

function NearbyMap({ events, language }: { events: KiwiCueEvent[]; language: Language }) {
  const [selectedId, setSelectedId] = useState<string>();
  const event = events.find(item => item.id === selectedId) ?? events[0];
  if (!event?.venue?.coordinates) return null;
  return <div className="discovery-venue-map">
    <label htmlFor="discovery-map-event">{language === "zh" ? "选择地图中的活动" : "Choose an event on the map"}</label>
    <select id="discovery-map-event" value={event.id} onChange={change => setSelectedId(change.target.value)}>
      {events.map(item => <option key={item.id} value={item.id}>{eventDisplayName(item, language)} · {item.venue?.name}</option>)}
    </select>
    <EventMap coordinates={event.venue.coordinates} venueName={event.venue.name} language={language} />
  </div>;
}

const labels = {
  en: { all: "More to discover", tonight: "Tonight", weekend: "This weekend", free: "Free", music: "Live music", nearby: "Around Auckland", surprise: "Surprise me", back: "Back to discovery", empty: "No matching events in the loaded selection. Try another collection or load more below.", scope: "Collections use the events loaded so far. More may be available below.", location: "Sort by my distance", privacy: "Location stays on this device. Distances are straight-line estimates.", unavailable: "Location unavailable. You can still explore Auckland venues.", checking: "Finding your location…" },
  zh: { all: "继续发现", tonight: "今晚", weekend: "本周末", free: "免费", music: "现场音乐", nearby: "奥克兰地图", surprise: "给我惊喜", back: "返回发现", empty: "已加载活动中暂时没有匹配内容。可以换个合集，或在下方加载更多。", scope: "合集来自当前已加载的活动，下方还可以继续加载。", location: "按离我距离排序", privacy: "位置只在当前设备使用，距离为直线估算。", unavailable: "暂时无法定位，仍可浏览奥克兰场馆。", checking: "正在定位…" },
};

function FeaturedEvent({ event, language }: { event: KiwiCueEvent; language: Language }) {
  const name = eventDisplayName(event, language);
  return <article className="discovery-feature">
    <Link href={`/events/${encodeURIComponent(event.id)}`} aria-label={language === "zh" ? `打开精选活动：${name}` : `Explore featured event: ${name}`}>
      <EventImage src={event.editorialPreview?.image?.url ?? event.imageUrl} alt="" loading="eager" fallback={<span className="discovery-image-fallback">{formatEventCategory(event.category, language)}</span>} />
      <div className="discovery-feature-caption"><span className="discovery-category">{formatEventCategory(event.category, language)}</span><h2>{name}</h2><p>{formatEventDate(event.start.localDate, language)} · {formatEventTime(event.start.localTime, language)}</p>{event.venue && <p>{event.venue.name}</p>}</div>
    </Link>
    <BookmarkButton event={event} language={language} />
  </article>;
}

export function DiscoveryHub({ events, language, now = new Date() }: { events: KiwiCueEvent[]; language: Language; now?: Date }) {
  const collection = useDiscoveryCollection();
  const [position, setPosition] = useState<EventCoordinates>();
  const [locationState, setLocationState] = useState<"idle" | "loading" | "error">("idle");
  const [surpriseId, setSurpriseId] = useState<string>();
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const content = labels[language];
  const available = selectCollectionEvents(events, "all", now);
  const selected = selectCollectionEvents(events, collection, now, position);
  const feature = available.find(event => event.id === surpriseId) ?? available.find(event => event.imageUrl || event.editorialPreview?.image) ?? available[0];

  useEffect(() => {
    if (collection !== "all") resultHeading.current?.focus({ preventScroll: true });
  }, [collection]);

  function open(next: DiscoveryCollection) {
    navigateDiscovery(next);
  }
  function locate() {
    if (!navigator.geolocation) { setLocationState("error"); return; }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(value => {
      const coordinates = { latitude: value.coords.latitude, longitude: value.coords.longitude };
      if (!isValidCoordinates(coordinates)) { setLocationState("error"); return; }
      setPosition(coordinates); setLocationState("idle");
    }, () => setLocationState("error"), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }
  function surprise() {
    const candidates = available.filter(event => event.id !== feature?.id).slice(0, 20);
    if (!candidates.length) return;
    setSurpriseId(candidates[Math.floor(Math.random() * candidates.length)].id);
    navigateDiscovery("all");
  }
  const chips = [
    { id: "tonight", icon: "moon" }, { id: "nearby", icon: "pin" }, { id: "free", icon: "tag" },
    { id: "weekend", icon: "people" }, { id: "music", icon: "heart" },
  ] as const;
  return <div className="discovery-hub">
    <nav className="discovery-chips" aria-label={language === "zh" ? "快捷发现" : "Quick discovery"}>
      {chips.map(chip => <button key={chip.id} data-tone={chip.id} aria-pressed={collection === chip.id} onClick={() => open(chip.id)}><DiscoveryIcon name={chip.icon} />{chip.id === "nearby" ? language === "zh" ? "附近" : "Nearby" : content[chip.id]}</button>)}
      <button data-tone="surprise" onClick={surprise} disabled={available.length < 2}><DiscoveryIcon name="dice" />{content.surprise}</button>
    </nav>
    {collection === "all" ? <>
      <div className="discovery-feature-layout">{feature && <FeaturedEvent key={feature.id} event={feature} language={language} />}</div>
      <div className="discovery-stacks">{(["tonight", "weekend", "free", "music"] as const).map(id => <EventStack key={id} title={content[id]} events={selectCollectionEvents(events, id, now)} language={language} onOpen={() => open(id)} />)}</div>
      <p className="discovery-scope">{content.scope} <Link href="/recommendations">{language === "zh" ? "浏览本地精选" : "Browse local picks"}</Link></p>
    </> : <button className="discovery-back" onClick={() => open("all")}><span aria-hidden="true">← </span>{content.back}</button>}
    <section className="discovery-list-section" id="map">
      <h2 ref={resultHeading} tabIndex={-1}>{content[collection]}</h2>
      {collection === "nearby" && <div className="discovery-nearby"><button onClick={locate} disabled={locationState === "loading"}>{locationState === "loading" ? content.checking : content.location}</button><p>{content.privacy}</p>{locationState === "error" && <p role="status">{content.unavailable}</p>}<NearbyMap events={selected} language={language} /></div>}
      {!selected.length && <p className="discovery-empty" role="status">{content.empty}</p>}
      <ol className="discovery-feed">{selected.map((event, index) => <li key={event.id}><EventCard event={event} index={index} language={language} variant="row" />{position && collection === "nearby" && event.venue?.coordinates && <p className="discovery-distance">{formatDistanceKm(distanceKm(position, event.venue.coordinates), language)}</p>}</li>)}</ol>
    </section>
  </div>;
}
