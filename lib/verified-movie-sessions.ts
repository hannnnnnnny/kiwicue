import type { MoviePreview } from "./movie-previews";
import type { KiwiCueScreening } from "./movies";

type MatchableMovie = Pick<MoviePreview, "title" | "originalTitle"> & { runtimeMinutes?: number | null };

function normalizedMovieTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-NZ")
    .replace(/&/gu, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function titlesFor(movie: MatchableMovie, englishMovie?: MatchableMovie): Set<string> {
  return new Set([movie.title, movie.originalTitle, englishMovie?.title, englishMovie?.originalTitle]
    .filter((title): title is string => Boolean(title))
    .map(normalizedMovieTitle));
}

function compatibleRuntime(movie: MatchableMovie, screening: Pick<KiwiCueScreening, "runtimeMinutes">): boolean {
  if (movie.runtimeMinutes === null || movie.runtimeMinutes === undefined
    || screening.runtimeMinutes === null || screening.runtimeMinutes === undefined) return true;
  return Math.abs(movie.runtimeMinutes - screening.runtimeMinutes) <= 10;
}

export function findMovieSessionMatches<T extends Pick<KiwiCueScreening, "filmTitle" | "runtimeMinutes">>(
  movie: MatchableMovie,
  screenings: T[],
  englishMovie?: MatchableMovie,
): T[] {
  const titles = titlesFor(movie, englishMovie);
  return screenings.filter((screening) => titles.has(normalizedMovieTitle(screening.filmTitle))
    && compatibleRuntime(movie, screening));
}

export function movieHasVerifiedSession(
  movie: MatchableMovie,
  screenings: Array<Pick<KiwiCueScreening, "filmTitle" | "runtimeMinutes">>,
): boolean {
  return findMovieSessionMatches(movie, screenings).length > 0;
}

export function filterVerifiedMoviePreviews(
  movies: MoviePreview[],
  screenings: KiwiCueScreening[],
): MoviePreview[] {
  return movies.filter((movie) => {
    // List previews intentionally omit runtime; title-only matches are not enough
    // to promote a film before its detail page can perform the stricter check.
    const runtimeMinutes = "runtimeMinutes" in movie ? movie.runtimeMinutes : undefined;
    return typeof runtimeMinutes === "number" && movieHasVerifiedSession({ ...movie, runtimeMinutes }, screenings);
  });
}
