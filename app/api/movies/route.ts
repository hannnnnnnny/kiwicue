import { fetchAucklandSessions, summarizeShowings, type AucklandSessions } from "../../../lib/cinemas/auckland-sessions";
import { isMovieDateFilter, parseMovieDateFilter, parseMovieQuery } from "../../../lib/movie-search-params";
import type { KiwiCueScreening, MovieDateFilter } from "../../../lib/movies";

type LoadSessions = (input: { date: MovieDateFilter }) => Promise<AucklandSessions>;

function invalidParameters(url: URL, query: string | null): boolean {
  const queryValues = url.searchParams.getAll("q");
  const dateValues = url.searchParams.getAll("date");
  if (queryValues.length > 1 || dateValues.length > 1) return true;
  const rawQuery = queryValues[0];
  if (rawQuery !== undefined && rawQuery.trim().length > 0 && query === null) return true;
  const rawDate = dateValues[0];
  return rawDate !== undefined && !isMovieDateFilter(rawDate);
}

function normalizedSearchText(value: string): string {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").toLocaleLowerCase("en-NZ");
}

function filterScreenings(screenings: KiwiCueScreening[], query: string | null): KiwiCueScreening[] {
  if (!query) return screenings;
  const needle = normalizedSearchText(query);
  return screenings.filter(({ filmTitle, cinemaName }) =>
    normalizedSearchText(`${filmTitle} ${cinemaName}`).includes(needle));
}

export async function handleMoviesRequest(
  request: Request,
  loadSessions?: LoadSessions,
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
  const checkedAt = now.toISOString();
  const load = loadSessions ?? (({ date: requested }) => fetchAucklandSessions({ date: requested, now }));
  try {
    const { screenings, unavailableChains } = await load({ date });
    const films = summarizeShowings(filterScreenings(screenings, query));
    return Response.json({
      films, sourceState: films.length > 0 ? "ready" : "empty", unavailableChains, checkedAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { films: [], sourceState: "unavailable", unavailableChains: [], checkedAt },
      { headers: { "cache-control": "no-store" } },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleMoviesRequest(request);
}
