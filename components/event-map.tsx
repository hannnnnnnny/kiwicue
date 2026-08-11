"use client";

import { useEffect, useState } from "react";
import type { Language } from "./language-provider";
import { isValidCoordinates } from "../lib/distance";
import type { EventCoordinates } from "../lib/events";

const copy = {
  en: {
    title: (venue: string) => `Map of ${venue}`,
    larger: "Open larger map",
    unavailable: "Map preview is temporarily unavailable.",
    recover: "Open venue in OpenStreetMap",
    attribution: "OpenStreetMap contributors",
  },
  zh: {
    title: (venue: string) => `${venue}地图`,
    larger: "打开大地图",
    unavailable: "地图预览暂时无法显示。",
    recover: "在 OpenStreetMap 中打开场馆",
    attribution: "OpenStreetMap 贡献者",
  },
} as const;

const MAP_LOAD_TIMEOUT_MS = 8_000;

export function buildOpenStreetMapUrls(coordinates: EventCoordinates): {
  embed: string;
  larger: string;
} {
  if (!isValidCoordinates(coordinates)) throw new RangeError("Invalid coordinates");
  const { latitude, longitude } = coordinates;
  const latitudeDelta = 0.012;
  const longitudeDelta = 0.018;
  const embed = new URL("https://www.openstreetmap.org/export/embed.html");
  embed.search = new URLSearchParams({
    bbox: [
      longitude - longitudeDelta,
      latitude - latitudeDelta,
      longitude + longitudeDelta,
      latitude + latitudeDelta,
    ].join(","),
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  }).toString();
  const larger = new URL("https://www.openstreetmap.org/");
  larger.search = new URLSearchParams({
    mlat: String(latitude),
    mlon: String(longitude),
  }).toString();
  larger.hash = `map=15/${latitude}/${longitude}`;
  return { embed: embed.toString(), larger: larger.toString() };
}

export function EventMap({ coordinates, language, venueName }: {
  coordinates: EventCoordinates;
  language: Language;
  venueName: string;
}) {
  const content = copy[language];
  const urls = buildOpenStreetMapUrls(coordinates);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const loaded = loadedUrl === urls.embed;
  const failed = failedUrl === urls.embed;

  useEffect(() => {
    if (loaded || failed) return;
    const timeout = window.setTimeout(() => setFailedUrl(urls.embed), MAP_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [failed, loaded, urls.embed]);

  if (failed) {
    return (
      <div className="event-map-unavailable event-map-failure" role="status">
        <p>{content.unavailable}</p>
        <a href={urls.larger} target="_blank" rel="noreferrer noopener">
          {content.recover}<span aria-hidden="true"> ↗</span>
        </a>
      </div>
    );
  }

  return (
    <figure className="event-map" onErrorCapture={() => setFailedUrl(urls.embed)}>
      <iframe
        title={content.title(venueName)}
        src={urls.embed}
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={() => setLoadedUrl(urls.embed)}
        onError={() => setFailedUrl(urls.embed)}
      />
      <figcaption>
        <a href={urls.larger} target="_blank" rel="noreferrer noopener">
          {content.larger}<span aria-hidden="true"> ↗</span>
        </a>
        <span>
          © <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer noopener"
          >{content.attribution}</a>
        </span>
      </figcaption>
    </figure>
  );
}
