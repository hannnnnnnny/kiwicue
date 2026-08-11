import type { MoviePreviewLanguage, MoviePreviewPage } from "../../../lib/movie-previews";
import {
  parseMoviePreviewLanguage,
  parseMoviePreviewPage,
  parseMoviePreviewQuery,
} from "../../../lib/movie-previews";
import { fetchTmdbMoviePreviews, TmdbClientError } from "../../../lib/tmdb";

type LoadMovies = (input: {
  language: MoviePreviewLanguage;
  query: string | null;
  page: number;
}) => Promise<MoviePreviewPage>;

const SHARED_CACHE = "public, s-maxage=900, stale-while-revalidate=86400";

function invalidParameters(url: URL, query: string | null): boolean {
  const languageValues = url.searchParams.getAll("language");
  const queryValues = url.searchParams.getAll("q");
  const pageValues = url.searchParams.getAll("page");
  if (languageValues.length > 1 || queryValues.length > 1 || pageValues.length > 1) return true;
  const language = languageValues[0];
  if (language !== undefined && language !== "en" && language !== "zh") return true;
  const rawQuery = queryValues[0];
  return rawQuery !== undefined && rawQuery.trim().length > 0 && query === null;
}

function safeError(error: unknown): Response {
  if (error instanceof TmdbClientError) {
    return Response.json(
      { error: { code: error.code, message: "Movie previews are temporarily unavailable." } },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Movie previews are temporarily unavailable." } },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function handleMoviePreviewsRequest(
  request: Request,
  loadMovies: LoadMovies = fetchTmdbMoviePreviews,
): Promise<Response> {
  const url = new URL(request.url);
  const query = parseMoviePreviewQuery(url.searchParams.getAll("q")[0] ?? null);
  if (invalidParameters(url, query)) {
    return Response.json(
      { error: { code: "INVALID_QUERY", message: "Use one valid movie query and language." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const language = parseMoviePreviewLanguage(url.searchParams.get("language"));
  const page = parseMoviePreviewPage(url.searchParams.get("page"));
  try {
    const payload = await loadMovies({ language, query, page });
    return Response.json(payload, { headers: { "cache-control": SHARED_CACHE } });
  } catch (error) {
    return safeError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleMoviePreviewsRequest(request);
}
