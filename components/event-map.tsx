import type { Language } from "./language-provider";
import { isValidCoordinates } from "../lib/distance";
import type { EventCoordinates } from "../lib/events";

const copy = {
  en: {
    title: (venue: string) => `Map of ${venue}`,
    larger: "Open larger map",
    attribution: "OpenStreetMap contributors",
  },
  zh: {
    title: (venue: string) => `${venue}地图`,
    larger: "打开大地图",
    attribution: "OpenStreetMap 贡献者",
  },
} as const;

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
  return (
    <figure className="event-map">
      <iframe
        title={content.title(venueName)}
        src={urls.embed}
        loading="lazy"
        referrerPolicy="no-referrer"
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
