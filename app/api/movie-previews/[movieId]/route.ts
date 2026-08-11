import type { MoviePreviewDetail, MoviePreviewLanguage } from "../../../../lib/movie-previews";
import { parseMovieId, parseMoviePreviewLanguage } from "../../../../lib/movie-previews";
import { fetchTmdbMovieDetail, TmdbClientError } from "../../../../lib/tmdb";

type LoadMovie = (input: {
  movieId: number;
  language: MoviePreviewLanguage;
}) => Promise<MoviePreviewDetail>;

const SHARED_CACHE = "public, s-maxage=900, stale-while-revalidate=86400";

function detailError(error: unknown): Response {
  if (error instanceof TmdbClientError) {
    const message = error.code === "UPSTREAM_NOT_FOUND"
      ? "Movie not found."
      : "Movie previews are temporarily unavailable.";
    return Response.json(
      { error: { code: error.code, message } },
      { status: error.status, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Movie previews are temporarily unavailable." } },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

export async function handleMoviePreviewDetailRequest(
  movieIdInput: string,
  languageInput: string | null,
  loadMovie: LoadMovie = fetchTmdbMovieDetail,
): Promise<Response> {
  const movieId = parseMovieId(movieIdInput);
  if (!movieId) {
    return Response.json(
      { error: { code: "INVALID_MOVIE_ID", message: "Invalid movie ID." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (languageInput !== null && languageInput !== "en" && languageInput !== "zh") {
    return Response.json(
      { error: { code: "INVALID_LANGUAGE", message: "Invalid language." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  const language = parseMoviePreviewLanguage(languageInput);
  try {
    const movie = await loadMovie({ movieId, language });
    return Response.json({ movie }, { headers: { "cache-control": SHARED_CACHE } });
  } catch (error) {
    return detailError(error);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ movieId: string }> },
): Promise<Response> {
  const { movieId } = await context.params;
  const language = new URL(request.url).searchParams.get("language");
  return handleMoviePreviewDetailRequest(movieId, language);
}
