import type {
  MoviePreviewDetail,
  MoviePreviewLanguage,
  MovieSessionStatus,
} from "../../../../lib/movie-previews";
import { parseMovieId, parseMoviePreviewLanguage } from "../../../../lib/movie-previews";
import { fetchAucklandSessions, type AucklandSessions } from "../../../../lib/cinemas/auckland-sessions";
import { attachHoytsPrices } from "../../../../lib/cinemas/hoyts";
import { CinemaSourceError } from "../../../../lib/cinemas/source-fetch";
import type { CinemaChain, KiwiCueScreening } from "../../../../lib/movies";
import { fetchTmdbMovieDetail, TmdbClientError } from "../../../../lib/tmdb";
import { findMovieSessionMatches } from "../../../../lib/verified-movie-sessions";

type LoadMovie = (input: {
  movieId: number;
  language: MoviePreviewLanguage;
}) => Promise<MoviePreviewDetail>;

type LoadSessions = () => Promise<AucklandSessions>;
type AttachPrices = (sessions: KiwiCueScreening[]) => Promise<KiwiCueScreening[]>;

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
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Movie previews are temporarily unavailable." } },
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

async function matchSessions(
  movie: MoviePreviewDetail,
  localizedMovie: MoviePreviewDetail | undefined,
  loadSessions: LoadSessions,
  attachPrices: AttachPrices,
): Promise<{ sessionStatus: MovieSessionStatus; screenings: KiwiCueScreening[]; unavailableChains: CinemaChain[] }> {
  try {
    const { screenings, unavailableChains } = await loadSessions();
    const matches = findMovieSessionMatches(movie, screenings, localizedMovie);
    if (matches.length === 0) return { sessionStatus: "unverified", screenings: [], unavailableChains };
    return { sessionStatus: "verified", screenings: await attachPrices(matches), unavailableChains };
  } catch (error) {
    if (!(error instanceof CinemaSourceError)) throw error;
    return { sessionStatus: "unavailable", screenings: [], unavailableChains: [] };
  }
}

export async function handleMoviePreviewDetailRequest(
  movieIdInput: string,
  languageInput: string | null,
  loadMovie: LoadMovie = fetchTmdbMovieDetail,
  loadSessions?: LoadSessions,
  now = new Date(),
  attachPrices: AttachPrices = (sessions) => attachHoytsPrices(sessions),
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
    const { sessionStatus, screenings, unavailableChains } = await matchSessions(
      verificationMovie,
      language === "zh" ? movie : undefined,
      loadSessions ?? (() => fetchAucklandSessions({ date: "all", now })),
      attachPrices,
    );
    const checkedAt = now.toISOString();
    return Response.json({ movie, screenings, sessionStatus, unavailableChains, checkedAt }, { headers: { "cache-control": "no-store" } });
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
