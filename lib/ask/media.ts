import "server-only";
import type { MoviePreview } from "../movie-previews";
import { fetchTmdbMovieDetail, fetchTmdbMoviePreviews } from "../tmdb";
import { normalizedMovieTitle } from "../verified-movie-sessions";
import { logAskFailure } from "./log";
import type { AskCard } from "./schema";

type Language = "en" | "zh";
export type CardMedia = { id: string; imageUrl: string | null; trailerKey: string | null };
export type MediaLookup = (input: { cards: AskCard[]; bestId: string | null; language: Language }) => Promise<CardMedia[]>;
export type MediaSources = {
  search(title: string): Promise<MoviePreview[]>;
  trailer(movieId: number, language: Language): Promise<string | null>;
  now(): number;
};

const MAX_MOVIES = 6;
const CACHE_MS = 6 * 3_600_000;
export const TMDB_IMAGE_PREFIX = "https://image.tmdb.org/";
export const TRAILER_KEY = /^[A-Za-z0-9_-]{11}$/u;

/** Cinema listings add formats such as "(3D)" or "[IMAX]" that TMDB titles never carry. */
export function matchTitle(title: string): string {
  return normalizedMovieTitle(title.replace(/\s*[([][^)\]]*[)\]]/gu, " "));
}

function searchText(title: string): string {
  return title.replace(/\s*[([][^)\]]*[)\]]/gu, " ").trim();
}

function cached<T>(store: Map<string, { at: number; value: T }>, key: string, now: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && now - hit.at <= CACHE_MS) return Promise.resolve(hit.value);
  return load().then((value) => { store.set(key, { at: now, value }); return value; });
}

/** Posters for movie cards and a trailer for the best match, from exact title matches only. */
export function createMediaLookup(sources: MediaSources): MediaLookup {
  const matches = new Map<string, { at: number; value: MoviePreview | null }>();
  const trailers = new Map<string, { at: number; value: string | null }>();

  async function mediaFor(card: AskCard, best: boolean, language: Language): Promise<CardMedia | null> {
    const wanted = matchTitle(card.title);
    const now = sources.now();
    const movie = await cached(matches, wanted, now, async () =>
      (await sources.search(searchText(card.title))).find((item) => matchTitle(item.title) === wanted) ?? null);
    if (!movie) return null;
    const imageUrl = movie.posterUrl?.startsWith(TMDB_IMAGE_PREFIX) ? movie.posterUrl : null;
    const key = best ? await cached(trailers, `${movie.id}:${language}`, now, () => sources.trailer(movie.id, language)) : null;
    const trailerKey = key && TRAILER_KEY.test(key) ? key : null;
    return imageUrl || trailerKey ? { id: card.id, imageUrl, trailerKey } : null;
  }

  return async ({ cards, bestId, language }) => {
    const movies = cards.filter((card) => card.kind === "movie").slice(0, MAX_MOVIES);
    const found = await Promise.all(movies.map((card) => mediaFor(card, card.id === bestId, language).catch((error: unknown) => {
      logAskFailure("media", error);
      return null;
    })));
    return found.filter((media): media is CardMedia => media !== null);
  };
}

export const tmdbMediaLookup = createMediaLookup({
  search: async (title) => (await fetchTmdbMoviePreviews({ language: "en", query: title, page: 1 })).movies,
  trailer: async (movieId, language) => (await fetchTmdbMovieDetail({ movieId, language })).trailerKey,
  now: () => Date.now(),
});
