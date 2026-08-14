import type { MoviePreview } from "./movie-previews";
import type { KiwiCueScreening } from "./movies";

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

export function movieHasVerifiedSession(
  movie: Pick<MoviePreview, "title" | "originalTitle">,
  screenings: Array<Pick<KiwiCueScreening, "filmTitle">>,
): boolean {
  const currentTitles = new Set(screenings.map(({ filmTitle }) => normalizedMovieTitle(filmTitle)));
  return [movie.title, movie.originalTitle]
    .filter((title): title is string => Boolean(title))
    .some((title) => currentTitles.has(normalizedMovieTitle(title)));
}

export function filterVerifiedMoviePreviews(
  movies: MoviePreview[],
  screenings: KiwiCueScreening[],
): MoviePreview[] {
  return movies.filter((movie) => movieHasVerifiedSession(movie, screenings));
}
