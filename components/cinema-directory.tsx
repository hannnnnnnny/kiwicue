import type { AucklandCinema, AucklandCinemaWithDistance } from "../lib/cinema-directory";
import { CinemaBrandMark } from "./cinema-brand-mark";
import type { Language } from "./language-provider";

const copy = {
  en: {
    eyebrow: "Always available",
    title: "Auckland cinema directory",
    description: "Open a cinema's official site for the latest sessions and booking details.",
    sessions: (name: string) => `${name} sessions`,
    map: (name: string) => `Map for ${name}`,
    mapText: "Map",
    away: (distance: number) => `${distance.toFixed(1)} km away`,
    empty: "No cinemas match this search.",
  },
  zh: {
    eyebrow: "始终可用",
    title: "奥克兰影院目录",
    description: "打开影院官网，查看最新场次和预约信息。",
    sessions: (name: string) => `${name} 场次`,
    map: (name: string) => `查看 ${name} 地图`,
    mapText: "地图",
    away: (distance: number) => `距离约 ${distance.toFixed(1)} 公里`,
    empty: "没有影院符合当前搜索。",
  },
} as const;

function hasDistance(cinema: AucklandCinema | AucklandCinemaWithDistance): cinema is AucklandCinemaWithDistance {
  return "distanceKilometres" in cinema;
}

function TicketIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7.5A2.5 2.5 0 0 0 6.5 5h11A2.5 2.5 0 0 0 20 7.5v1a2 2 0 0 1 0 4v1a2.5 2.5 0 0 0-2.5 2.5h-11A2.5 2.5 0 0 0 4 13.5v-1a2 2 0 0 1 0-4v-1Z" />
      <path d="M12 7.5v9" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

export function CinemaDirectory({ cinemas, language }: {
  cinemas: ReadonlyArray<AucklandCinema | AucklandCinemaWithDistance>;
  language: Language;
}) {
  const content = copy[language];
  return (
    <section className="cinema-directory" id="cinema-directory" aria-labelledby="cinema-directory-title">
      <header><p className="eyebrow">{content.eyebrow}</p><h2 id="cinema-directory-title">{content.title}</h2><p>{content.description}</p></header>
      {cinemas.length === 0 ? <p className="cinema-directory-empty">{content.empty}</p> : (
        <ol className="cinema-directory-list">
          {cinemas.map((cinema) => {
            const mapUrl = `https://www.openstreetmap.org/?mlat=${cinema.coordinates.latitude}&mlon=${cinema.coordinates.longitude}#map=16/${cinema.coordinates.latitude}/${cinema.coordinates.longitude}`;
            return (
              <li key={cinema.id}>
                <div className="cinema-directory-identity">
                  <CinemaBrandMark asset={cinema.brandAsset} label={cinema.brandLabel} cinemaId={cinema.id} />
                  <div>
                    <span>{cinema.chain}</span><h3>{cinema.name}</h3><p>{cinema.address}</p>{hasDistance(cinema) ? <strong>{content.away(cinema.distanceKilometres)}</strong> : null}
                  </div>
                </div>
                <div className="cinema-directory-actions">
                  <a href={cinema.sessionsUrl} target="_blank" rel="noreferrer noopener" aria-label={content.sessions(cinema.name)}><TicketIcon />{content.sessions(cinema.name)}</a>
                  <a href={mapUrl} target="_blank" rel="noreferrer noopener" aria-label={content.map(cinema.name)}><MapPinIcon />{content.mapText}</a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
