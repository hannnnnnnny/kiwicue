import { distanceKm } from "./distance";
import type { EventCoordinates } from "./events";

export type AucklandCinema = {
  id: string;
  name: string;
  chain: string;
  brandAsset: string | null;
  brandLabel: string;
  suburb: string;
  address: string;
  coordinates: EventCoordinates;
  sessionsUrl: string;
};

export type AucklandCinemaWithDistance = AucklandCinema & {
  distanceKilometres: number;
};

export const AUCKLAND_CINEMAS: readonly AucklandCinema[] = [
  { id: "academy", name: "Academy Cinemas", chain: "Independent", brandAsset: "/cinemas/academy.png", brandLabel: "AC", suburb: "Auckland Central", address: "44 Lorne Street, Auckland Central 1010", coordinates: { latitude: -36.8514, longitude: 174.7654 }, sessionsUrl: "https://academycinemas.co.nz/" },
  { id: "event-queen-street", name: "EVENT Cinemas Queen Street", chain: "EVENT Cinemas", brandAsset: "/cinemas/event.png", brandLabel: "EC", suburb: "Auckland Central", address: "Level 3, 291–297 Queen Street, Auckland Central 1010", coordinates: { latitude: -36.8524, longitude: 174.7631 }, sessionsUrl: "https://www.eventcinemas.co.nz/Cinema/Queen-Street" },
  { id: "event-newmarket", name: "EVENT Cinemas Newmarket", chain: "EVENT Cinemas", brandAsset: "/cinemas/event.png", brandLabel: "EC", suburb: "Newmarket", address: "Westfield Newmarket, 309 Broadway, Newmarket 1023", coordinates: { latitude: -36.8707, longitude: 174.7778 }, sessionsUrl: "https://www.eventcinemas.co.nz/Cinema/Newmarket" },
  { id: "event-st-lukes", name: "EVENT Cinemas St Lukes", chain: "EVENT Cinemas", brandAsset: "/cinemas/event.png", brandLabel: "EC", suburb: "St Lukes", address: "Level 2, Westfield St Lukes, St Lukes Road, Auckland 1025", coordinates: { latitude: -36.8834, longitude: 174.7342 }, sessionsUrl: "https://www.eventcinemas.co.nz/Cinema/St-Lukes" },
  { id: "hoyts-sylvia-park", name: "HOYTS Sylvia Park", chain: "HOYTS", brandAsset: "/cinemas/hoyts.png", brandLabel: "H", suburb: "Mount Wellington", address: "Sylvia Park, 286 Mount Wellington Highway, Auckland 1060", coordinates: { latitude: -36.9165, longitude: 174.8403 }, sessionsUrl: "https://www.hoyts.co.nz/cinemas/sylvia-park" },
  { id: "hoyts-ormiston", name: "HOYTS Ormiston", chain: "HOYTS", brandAsset: "/cinemas/hoyts.png", brandLabel: "H", suburb: "Flat Bush", address: "Ormiston Town Centre, 240 Ormiston Road, Flat Bush 2019", coordinates: { latitude: -36.9687, longitude: 174.9129 }, sessionsUrl: "https://www.hoyts.co.nz/cinemas/ormiston" },
  { id: "hoyts-wairau-park", name: "HOYTS Wairau Park", chain: "HOYTS", brandAsset: "/cinemas/hoyts.png", brandLabel: "H", suburb: "Wairau Valley", address: "15 Link Drive, Wairau Valley 0627", coordinates: { latitude: -36.7834, longitude: 174.7444 }, sessionsUrl: "https://www.hoyts.co.nz/cinemas/wairau-park" },
  { id: "reading-lynnmall", name: "Reading Cinemas LynnMall", chain: "Reading Cinemas", brandAsset: "/cinemas/reading.svg", brandLabel: "RC", suburb: "New Lynn", address: "LynnMall, 3058 Great North Road, New Lynn 0600", coordinates: { latitude: -36.9091, longitude: 174.6845 }, sessionsUrl: "https://readingcinemas.co.nz/cinemas/details/lynnmall" },
  { id: "bridgeway", name: "Bridgeway Cinema", chain: "Independent", brandAsset: "/cinemas/bridgeway.png", brandLabel: "B", suburb: "Northcote Point", address: "122 Queen Street, Northcote Point 0627", coordinates: { latitude: -36.8161, longitude: 174.7452 }, sessionsUrl: "https://www.bridgeway.co.nz/" },
  { id: "capitol", name: "The Capitol Cinema", chain: "Independent", brandAsset: "/cinemas/capitol.png", brandLabel: "C", suburb: "Balmoral", address: "610 Dominion Road, Balmoral 1041", coordinates: { latitude: -36.8906, longitude: 174.7477 }, sessionsUrl: "https://www.thecapitol.co.nz/" },
  { id: "lido", name: "The Lido Cinema", chain: "Independent", brandAsset: "/cinemas/lido.png", brandLabel: "L", suburb: "Epsom", address: "427 Manukau Road, Epsom 1023", coordinates: { latitude: -36.8939, longitude: 174.7728 }, sessionsUrl: "https://www.lido.co.nz/" },
  { id: "rialto-newmarket", name: "Rialto Cinemas Newmarket", chain: "Rialto Cinemas", brandAsset: "/cinemas/rialto.png", brandLabel: "R", suburb: "Newmarket", address: "167–169 Broadway, Newmarket 1023", coordinates: { latitude: -36.8689, longitude: 174.7780 }, sessionsUrl: "https://www.rialto.co.nz/" },
  { id: "silky-otter-orakei", name: "Silky Otter Ōrākei", chain: "Silky Otter", brandAsset: null, brandLabel: "SO", suburb: "Ōrākei", address: "228 Ōrākei Road, Ōrākei 1071", coordinates: { latitude: -36.8601, longitude: 174.8104 }, sessionsUrl: "https://www.silkyotter.co.nz/cinemas/orakei" },
];

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-NZ");
}

export function filterCinemas(
  cinemas: readonly AucklandCinema[],
  query: string,
): AucklandCinema[] {
  const needle = searchable(query.trim());
  if (!needle) return [...cinemas];
  return cinemas.filter((cinema) => searchable([
    cinema.name,
    cinema.chain,
    cinema.suburb,
    cinema.address,
  ].join(" ")).includes(needle));
}

export function sortCinemasByDistance(
  cinemas: readonly AucklandCinema[],
  origin: EventCoordinates,
): AucklandCinemaWithDistance[] {
  return cinemas
    .map((cinema) => ({
      ...cinema,
      distanceKilometres: distanceKm(origin, cinema.coordinates),
    }))
    .sort((left, right) => left.distanceKilometres - right.distanceKilometres);
}
