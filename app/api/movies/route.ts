import { isMovieDateFilter, parseMovieDateFilter, parseMovieQuery } from "../../../lib/movie-search-params";
import type { KiwiCueScreening, MovieDateFilter } from "../../../lib/movies";
import { fetchAucklandScreenings } from "../../../lib/open-cinema";

type LoadScreenings = (input: {
  query: string | null;
  date: MovieDateFilter;
}) => Promise<KiwiCueScreening[]>;

function invalidParameters(url: URL, query: string | null): boolean {
  const queryValues = url.searchParams.getAll("q");
  const dateValues = url.searchParams.getAll("date");
  if (queryValues.length > 1 || dateValues.length > 1) return true;
  const rawQuery = queryValues[0];
  if (rawQuery !== undefined && rawQuery.trim().length > 0 && query === null) return true;
  const rawDate = dateValues[0];
  return rawDate !== undefined && !isMovieDateFilter(rawDate);
}

function defaultLoader(now: Date): LoadScreenings {
  return ({ query, date }) => fetchAucklandScreenings({
    query,
    date,
    now,
    apiKey: process.env.OPEN_CINEMA_API_KEY,
  });
}

export async function handleMoviesRequest(
  request: Request,
  loadScreenings?: LoadScreenings,
  now = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const query = parseMovieQuery(url.searchParams.getAll("q")[0] ?? null);
  if (invalidParameters(url, query)) {
    return Response.json(
      { error: { code: "INVALID_QUERY", message: "Use one valid movie query and date filter." } },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const date = parseMovieDateFilter(url.searchParams.getAll("date")[0] ?? null);
  try {
    const screenings = await (loadScreenings ?? defaultLoader(now))({ query, date });
    return Response.json({
      screenings,
      source: "open-cinema",
      sourceState: screenings.length > 0 ? "ready" : "empty",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({
      screenings: [],
      source: "open-cinema",
      sourceState: "unavailable",
    }, { headers: { "cache-control": "no-store" } });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleMoviesRequest(request);
}
