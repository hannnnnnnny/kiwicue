import "server-only";
import type { CinemaChain, KiwiCueScreening, MovieDateFilter, MovieShowing } from "../movies";
import { normalizedMovieTitle } from "../verified-movie-sessions";
import { datesForFilter } from "./auckland-time";
import { fetchEventScreenings } from "./event-cinemas";
import { fetchHoytsScreenings } from "./hoyts";
import { CinemaSourceError, type FetchImplementation } from "./source-fetch";

export type AucklandSessions = {
  screenings: KiwiCueScreening[];
  unavailableChains: CinemaChain[];
};

const LOADERS: ReadonlyArray<[CinemaChain, typeof fetchHoytsScreenings]> = [
  ["HOYTS", fetchHoytsScreenings],
  ["EVENT Cinemas", fetchEventScreenings],
];

/**
 * Each chain is loaded independently: one chain changing its feed should cost visitors that
 * chain's sessions, not the whole page. Only when every chain fails is the source unavailable.
 */
export async function fetchAucklandSessions(input: {
  date: MovieDateFilter;
  now: Date;
  fetchImpl?: FetchImplementation;
}): Promise<AucklandSessions> {
  const dates = datesForFilter(input.date, input.now);
  const results = await Promise.allSettled(LOADERS.map(([, load]) => load({ dates, fetchImpl: input.fetchImpl })));
  const unavailableChains = LOADERS.filter((_, index) => results[index].status === "rejected").map(([chain]) => chain);
  if (unavailableChains.length === LOADERS.length) throw new CinemaSourceError("UPSTREAM_ERROR");
  const unique = new Map<string, KiwiCueScreening>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const session of result.value) {
      if (Date.parse(session.startTime) >= input.now.getTime()) unique.set(session.id, session);
    }
  }
  const screenings = [...unique.values()].sort((left, right) =>
    Date.parse(left.startTime) - Date.parse(right.startTime) || left.cinemaName.localeCompare(right.cinemaName));
  return { screenings, unavailableChains };
}

/** Groups sessions (already sorted by start time) into one entry per film, across chains. */
export function summarizeShowings(screenings: KiwiCueScreening[]): MovieShowing[] {
  const films = new Map<string, MovieShowing & { cinemas: Set<string>; types: Set<string> }>();
  for (const session of screenings) {
    const key = normalizedMovieTitle(session.filmTitle);
    const film = films.get(key) ?? {
      id: key, title: session.filmTitle, rating: session.filmRating, runtimeMinutes: session.runtimeMinutes,
      cinemaCount: 0, sessionCount: 0, nextStartTime: session.startTime, nextCinemaName: session.cinemaName,
      screenTypes: [], cinemas: new Set<string>(), types: new Set<string>(),
    };
    film.sessionCount += 1;
    film.cinemas.add(session.cinemaId);
    film.types.add(session.screenType);
    film.rating ??= session.filmRating;
    film.runtimeMinutes ??= session.runtimeMinutes;
    films.set(key, film);
  }
  return [...films.values()].map(({ cinemas, types, ...film }) => ({
    ...film, cinemaCount: cinemas.size, screenTypes: [...types].sort((left, right) => left.localeCompare(right)),
  })).sort((left, right) => right.cinemaCount - left.cinemaCount || right.sessionCount - left.sessionCount);
}
