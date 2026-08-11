import type { MovieDateFilter } from "./movies";

const CONTROL_CHARACTERS = /\p{Cc}/u;
const MOVIE_DATE_FILTERS = new Set<MovieDateFilter>(["today", "tomorrow", "weekend", "all"]);
type PublicValue = string | string[] | null | undefined;

export function parseMovieQuery(value: PublicValue): string | null {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  return normalized && [...normalized].length <= 100 ? normalized : null;
}

export function isMovieDateFilter(value: unknown): value is MovieDateFilter {
  return typeof value === "string" && MOVIE_DATE_FILTERS.has(value as MovieDateFilter);
}

export function parseMovieDateFilter(value: PublicValue): MovieDateFilter {
  return isMovieDateFilter(value) ? value : "today";
}
