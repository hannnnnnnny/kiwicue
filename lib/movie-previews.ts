export type MoviePreviewLanguage = "en" | "zh";

export interface MoviePreview {
  id: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  ratingCount: number;
}

export interface MoviePreviewDetail extends MoviePreview {
  runtimeMinutes: number | null;
  genres: string[];
  certification: string | null;
  trailerKey: string | null;
  tmdbUrl: string;
}

export interface MoviePreviewPage {
  movies: MoviePreview[];
  page: {
    number: number;
    totalPages: number;
    totalResults: number;
  };
}

export function parseMoviePreviewLanguage(value: unknown): MoviePreviewLanguage {
  return value === "zh" ? "zh" : "en";
}

export function parseMoviePreviewQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  return normalized.length > 0 && normalized.length <= 100 ? normalized : null;
}

export function parseMoviePreviewPage(value: unknown): number {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return 1;
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 20 ? page : 1;
}

export function parseMovieId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const movieId = Number(value);
  return Number.isSafeInteger(movieId) ? movieId : null;
}
