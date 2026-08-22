import { isMovieDateFilter, parseMovieDateFilter, parseMovieQuery } from "../../../lib/movie-search-params";
import type { KiwiCueScreening, MovieCoverageState, MovieDateFilter } from "../../../lib/movies";
import { fetchAucklandCinemaCoverage, fetchAucklandScreenings } from "../../../lib/open-cinema";

type LoadScreenings = (input: {
  query: string | null;
  date: MovieDateFilter;
}) => Promise<KiwiCueScreening[]>;
type LoadCoverage = () => Promise<MovieCoverageState>;

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

function defaultCoverageLoader(): Promise<MovieCoverageState> {
  return fetchAucklandCinemaCoverage({ apiKey: process.env.OPEN_CINEMA_API_KEY });
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
  loadScreenings?: LoadScreenings,
  now = new Date(),
  loadCoverage: LoadCoverage = defaultCoverageLoader,
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
  try {
    const coverageState = await loadCoverage();
    if (coverageState === "not-covered") {
      return Response.json({
        screenings: [], source: "open-cinema", sourceState: "not-covered",
        coverageState, checkedAt,
      }, { headers: { "cache-control": "no-store" } });
    }
    const catalog = await (loadScreenings ?? defaultLoader(now))({ query: null, date });
    const screenings = filterScreenings(catalog, query);
    return Response.json({
      screenings,
      source: "open-cinema",
      sourceState: screenings.length > 0 ? "ready" : "empty",
      coverageState,
      checkedAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({
      screenings: [],
      source: "open-cinema",
      sourceState: "unavailable",
      coverageState: "unavailable",
      checkedAt,
    }, { headers: { "cache-control": "no-store" } });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleMoviesRequest(request);
}
