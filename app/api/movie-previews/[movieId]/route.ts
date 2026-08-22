import type {
  MoviePreviewDetail,
  MoviePreviewLanguage,
  MovieSessionStatus,
} from "../../../../lib/movie-previews";
import { parseMovieId, parseMoviePreviewLanguage } from "../../../../lib/movie-previews";
import type { KiwiCueScreening, MovieCoverageState, MovieDateFilter } from "../../../../lib/movies";
import {
  fetchAucklandCinemaCoverage,
  fetchAucklandScreenings,
  OpenCinemaClientError,
} from "../../../../lib/open-cinema";
import { fetchTmdbMovieDetail, TmdbClientError } from "../../../../lib/tmdb";
import { movieHasVerifiedSession } from "../../../../lib/verified-movie-sessions";

type LoadMovie = (input: {
  movieId: number;
  language: MoviePreviewLanguage;
}) => Promise<MoviePreviewDetail>;

type LoadScreenings = (input: {
  query: string | null;
  date: MovieDateFilter;
}) => Promise<KiwiCueScreening[]>;
type LoadCoverage = () => Promise<MovieCoverageState>;

function defaultScreeningLoader(now: Date): LoadScreenings {
  return ({ query, date }) => fetchAucklandScreenings({
    query,
    date,
    now,
    apiKey: process.env.OPEN_CINEMA_API_KEY,
  });
}

function defaultCoverageLoader(): Promise<MovieCoverageState> {
  return fetchAucklandCinemaCoverage({ apiKey: process.env.OPEN_CINEMA_API_KEY });
}

function invalidLanguageResponse(): Response {
  return Response.json(
    { error: { code: "INVALID_LANGUAGE", message: "Invalid language." } },
    { status: 400, headers: { "cache-control": "no-store" } },
  );
}

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
  if (error instanceof OpenCinemaClientError) {
    const status = error.code === "UPSTREAM_TIMEOUT" ? 504 : error.code === "UPSTREAM_BUSY" ? 503 : 502;
    return Response.json(
      { error: { code: error.code, message: "Current movie sessions are temporarily unavailable." } },
      { status, headers: { "cache-control": "no-store" } },
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
  loadScreenings?: LoadScreenings,
  now = new Date(),
  loadCoverage?: LoadCoverage,
): Promise<Response> {
  const movieId = parseMovieId(movieIdInput);
  if (!movieId) {
    return Response.json(
      { error: { code: "INVALID_MOVIE_ID", message: "Invalid movie ID." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (languageInput !== null && languageInput !== "en" && languageInput !== "zh") {
    return invalidLanguageResponse();
  }
  const language = parseMoviePreviewLanguage(languageInput);
  try {
    const movie = await loadMovie({ movieId, language });
    const verificationMovie = language === "en"
      ? movie
      : await loadMovie({ movieId, language: "en" });
    let sessionStatus: MovieSessionStatus = "unavailable";
    try {
      const coverage = await (loadCoverage ?? (loadScreenings
        ? async () => "covered" as const
        : defaultCoverageLoader))();
      if (coverage === "not-covered") {
        sessionStatus = "not-covered";
      } else {
        const screenings = await (loadScreenings ?? defaultScreeningLoader(now))({
          query: null,
          date: "all",
        });
        sessionStatus = movieHasVerifiedSession(verificationMovie, screenings)
          ? "verified"
          : "unverified";
      }
    } catch (error) {
      if (!(error instanceof OpenCinemaClientError)) throw error;
    }
    return Response.json({ movie, sessionStatus }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return detailError(error);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ movieId: string }> },
): Promise<Response> {
  const { movieId } = await context.params;
  const languages = new URL(request.url).searchParams.getAll("language");
  if (languages.length > 1) return invalidLanguageResponse();
  return handleMoviePreviewDetailRequest(movieId, languages[0] ?? null);
}
