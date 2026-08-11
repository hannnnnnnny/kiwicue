import "server-only";
import type {
  MoviePreview,
  MoviePreviewDetail,
  MoviePreviewLanguage,
  MoviePreviewPage,
} from "./movie-previews";

export type TmdbErrorCode =
  | "CONFIG_REQUIRED"
  | "UPSTREAM_NOT_FOUND"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

export class TmdbClientError extends Error {
  constructor(public readonly code: TmdbErrorCode, public readonly status: number) {
    super(code);
    this.name = "TmdbClientError";
  }
}

type TmdbListInput = {
  language: MoviePreviewLanguage;
  query: string | null;
  page: number;
};

const TMDB_API_ROOT = "https://api.themoviedb.org/3";
const TMDB_IMAGE_ROOT = "https://image.tmdb.org/t/p/w500";
const TMDB_REVALIDATE_SECONDS = 900;
const VIDEO_KEY_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const POSTER_PATH_PATTERN = /^\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localeFor(language: MoviePreviewLanguage): string {
  return language === "zh" ? "zh-CN" : "en-NZ";
}

function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  return normalized && normalized.length <= maximum ? normalized : null;
}

function validDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : null;
}

function validMovieId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function posterUrl(value: unknown): string | null {
  if (typeof value !== "string" || !POSTER_PATH_PATTERN.test(value)) return null;
  return `${TMDB_IMAGE_ROOT}${value}`;
}

function normalizedRating(record: Record<string, unknown>): { rating: number | null; count: number } {
  const count = typeof record.vote_count === "number" && Number.isInteger(record.vote_count) && record.vote_count >= 0
    ? record.vote_count
    : 0;
  const average = record.vote_average;
  const rating = count > 0 && typeof average === "number" && Number.isFinite(average) && average >= 0 && average <= 10
    ? average
    : null;
  return { rating, count };
}

export function buildTmdbMovieListUrl({ language, query, page }: TmdbListInput): URL {
  const path = query ? "/search/movie" : "/movie/now_playing";
  const url = new URL(`${TMDB_API_ROOT}${path}`);
  url.searchParams.set("language", localeFor(language));
  url.searchParams.set("page", String(page));
  url.searchParams.set("region", "NZ");
  if (query) {
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
  }
  return url;
}

export function buildTmdbMovieDetailUrl({
  movieId,
  language,
}: {
  movieId: number;
  language: MoviePreviewLanguage;
}): URL {
  if (!validMovieId(movieId)) throw new RangeError("Invalid TMDB movie ID");
  const url = new URL(`${TMDB_API_ROOT}/movie/${movieId}`);
  url.searchParams.set("language", localeFor(language));
  url.searchParams.set("append_to_response", "videos,release_dates");
  return url;
}

export function normalizeTmdbMovie(value: unknown): MoviePreview | null {
  if (!isRecord(value) || !validMovieId(value.id)) return null;
  const title = boundedText(value.title, 300);
  if (!title) return null;
  const originalTitle = boundedText(value.original_title, 300);
  const { rating, count } = normalizedRating(value);
  return {
    id: value.id,
    title,
    originalTitle: originalTitle && originalTitle !== title ? originalTitle : null,
    overview: boundedText(value.overview, 5_000),
    posterUrl: posterUrl(value.poster_path),
    releaseDate: validDate(value.release_date),
    rating,
    ratingCount: count,
  };
}

function normalizedGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const genres = value
    .map((item) => isRecord(item) ? boundedText(item.name, 80) : null)
    .filter((name): name is string => Boolean(name));
  return [...new Set(genres)].slice(0, 8);
}

function nzCertification(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null;
  const nz = value.results.find((item) => isRecord(item) && item.iso_3166_1 === "NZ");
  if (!isRecord(nz) || !Array.isArray(nz.release_dates)) return null;
  for (const item of nz.release_dates) {
    const certification = isRecord(item) ? boundedText(item.certification, 20) : null;
    if (certification) return certification;
  }
  return null;
}

function trailerScore(video: Record<string, unknown>, language: MoviePreviewLanguage): number {
  const target = language === "zh" ? "zh" : "en";
  if (video.official === true && video.iso_639_1 === target) return 30;
  if (video.official === true && video.iso_639_1 === "en") return 20;
  return 10;
}

export function selectTmdbTrailer(value: unknown, language: MoviePreviewLanguage): string | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null;
  const trailers = value.results
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter((item) => item.site === "YouTube" && item.type === "Trailer")
    .filter((item) => typeof item.key === "string" && VIDEO_KEY_PATTERN.test(item.key))
    .sort((left, right) => trailerScore(right, language) - trailerScore(left, language));
  return trailers.length > 0 ? trailers[0].key as string : null;
}

export function normalizeTmdbMovieDetail(
  value: unknown,
  language: MoviePreviewLanguage,
): MoviePreviewDetail | null {
  const preview = normalizeTmdbMovie(value);
  if (!preview || !isRecord(value)) return null;
  const runtime = value.runtime;
  return {
    ...preview,
    runtimeMinutes: typeof runtime === "number" && Number.isInteger(runtime) && runtime > 0 && runtime <= 600
      ? runtime
      : null,
    genres: normalizedGenres(value.genres),
    certification: nzCertification(value.release_dates),
    trailerKey: selectTmdbTrailer(value.videos, language),
    tmdbUrl: `https://www.themoviedb.org/movie/${preview.id}`,
  };
}

function errorForStatus(status: number): TmdbClientError {
  if (status === 404) return new TmdbClientError("UPSTREAM_NOT_FOUND", 404);
  if (status === 401 || status === 403) return new TmdbClientError("UPSTREAM_AUTH", 502);
  if (status === 429) return new TmdbClientError("UPSTREAM_BUSY", 503);
  return new TmdbClientError("UPSTREAM_ERROR", 502);
}

async function requestTmdb({
  url,
  token,
  fetchImpl,
}: {
  url: URL;
  token: string;
  fetchImpl: typeof fetch;
}): Promise<unknown> {
  if (!token.trim()) throw new TmdbClientError("CONFIG_REQUIRED", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json", authorization: `Bearer ${token}` },
      signal: controller.signal,
      next: { revalidate: TMDB_REVALIDATE_SECONDS },
    } as RequestInit & { next: { revalidate: number } });
    if (!response.ok) throw errorForStatus(response.status);
    return await response.json() as unknown;
  } catch (error) {
    if (error instanceof TmdbClientError) throw error;
    if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw new TmdbClientError("UPSTREAM_TIMEOUT", 504);
    }
    throw new TmdbClientError("UPSTREAM_ERROR", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedPage(value: unknown): MoviePreviewPage {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    throw new TmdbClientError("UPSTREAM_ERROR", 502);
  }
  const movies = value.results.map(normalizeTmdbMovie).filter((movie): movie is MoviePreview => movie !== null);
  const number = typeof value.page === "number" && Number.isInteger(value.page) && value.page >= 1 ? value.page : 1;
  const totalPages = typeof value.total_pages === "number" && Number.isInteger(value.total_pages) && value.total_pages >= 0
    ? Math.min(value.total_pages, 500)
    : number;
  const totalResults = typeof value.total_results === "number" && Number.isInteger(value.total_results) && value.total_results >= 0
    ? value.total_results
    : movies.length;
  return { movies, page: { number, totalPages, totalResults } };
}

export async function fetchTmdbMoviePreviews({
  token = process.env.TMDB_READ_ACCESS_TOKEN ?? "",
  fetchImpl = fetch,
  language,
  query,
  page,
}: TmdbListInput & { token?: string; fetchImpl?: typeof fetch }): Promise<MoviePreviewPage> {
  const payload = await requestTmdb({
    url: buildTmdbMovieListUrl({ language, query, page }),
    token,
    fetchImpl,
  });
  return normalizedPage(payload);
}

export async function fetchTmdbMovieDetail({
  token = process.env.TMDB_READ_ACCESS_TOKEN ?? "",
  fetchImpl = fetch,
  movieId,
  language,
}: {
  token?: string;
  fetchImpl?: typeof fetch;
  movieId: number;
  language: MoviePreviewLanguage;
}): Promise<MoviePreviewDetail> {
  const payload = await requestTmdb({
    url: buildTmdbMovieDetailUrl({ movieId, language }),
    token,
    fetchImpl,
  });
  const movie = normalizeTmdbMovieDetail(payload, language);
  if (!movie) throw new TmdbClientError("UPSTREAM_ERROR", 502);
  return movie;
}
