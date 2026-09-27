import type { MoviePreview } from "./movie-previews";
import type { KiwiCueScreening, MovieShowing } from "./movies";

type MatchableMovie = Pick<MoviePreview, "title" | "originalTitle"> & { runtimeMinutes?: number | null };

export function normalizedMovieTitle(value: string): string {
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

/**
 * List previews carry no runtime, so the list badge matches on title alone. That is enough to
 * say a film is showing; the detail page repeats the match with runtime before listing sessions.
 */
export function filterShowingMoviePreviews(
  movies: MoviePreview[],
  showings: Array<Pick<MovieShowing, "title">>,
): MoviePreview[] {
  const showingTitles = new Set(showings.map(({ title }) => normalizedMovieTitle(title)));
  return movies.filter((movie) => [...titlesFor(movie)].some((title) => showingTitles.has(title)));
}
