import "server-only";
import type { KiwiCueScreening, MovieCoverageState, MovieDateFilter } from "./movies";
import { isTrustedOfficialBookingUrl } from "./official-booking";

const OPEN_CINEMA_URL = "https://opencinemaproject.com/api/v1/public/screenings";
const OPEN_CINEMA_THEATERS_URL = "https://opencinemaproject.com/api/v1/public/theaters";
const REQUEST_TIMEOUT_MS = 8_000;
const SCREENING_REVALIDATE_SECONDS = 300;
const COVERAGE_REVALIDATE_SECONDS = 3_600;
const AUCKLAND_LATITUDE = "-36.8485";
const AUCKLAND_LONGITUDE = "174.7633";

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class OpenCinemaClientError extends Error {
  constructor(public readonly code: "UPSTREAM_BUSY" | "UPSTREAM_TIMEOUT" | "UPSTREAM_ERROR") {
    super(code);
    this.name = "OpenCinemaClientError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function safeHttpsUrl(value: unknown): value is string {
  if (!boundedString(value, 2_048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function aucklandDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function datesForFilter(filter: MovieDateFilter, now: Date): Array<string | null> {
  const today = aucklandDate(now);
  if (filter === "all") return [null];
  if (filter === "today") return [today];
  if (filter === "tomorrow") return [addDays(today, 1)];
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const saturdayOffset = day === 0 ? -1 : (6 - day + 7) % 7;
  const sundayOffset = saturdayOffset + 1;
  return day === 0 ? [today] : [addDays(today, saturdayOffset), addDays(today, sundayOffset)];
}

export function buildOpenCinemaUrls(input: {
  query: string | null;
  date: MovieDateFilter;
  now: Date;
}): URL[] {
  return datesForFilter(input.date, input.now).map((date) => {
    const url = new URL(OPEN_CINEMA_URL);
    url.searchParams.set("lat", AUCKLAND_LATITUDE);
    url.searchParams.set("lon", AUCKLAND_LONGITUDE);
    url.searchParams.set("radius_km", "100");
    url.searchParams.set("limit", "50");
    const query = input.query?.trim().slice(0, 100);
    if (query) url.searchParams.set("title", query);
    if (date) url.searchParams.set("date", date);
    return url;
  });
}

function parseFormats(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) return null;
  const formats = value.filter((item): item is string => boundedString(item, 40));
  return formats.length === value.length ? formats : null;
}

function parseOptionalNumber(value: unknown, maximum: number): number | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) return undefined;
  return value;
}

function parseBookingUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isRecord(value) || !safeHttpsUrl(value.url)) return undefined;
  return isTrustedOfficialBookingUrl(value.url) ? value.url : null;
}

function parseScreening(value: unknown): KiwiCueScreening | null {
  if (!isRecord(value)) return null;
  const formats = parseFormats(value.formats);
  const distance = parseOptionalNumber(value.distance_km, 1_000);
  const runtime = parseOptionalNumber(value.film_runtime_min, 1_000);
  const bookingUrl = parseBookingUrl(value.checkout);
  if (
    !boundedString(value.id, 128) || !boundedString(value.film_id, 128)
    || !boundedString(value.film_title, 300) || !boundedString(value.theater_id, 128)
    || !boundedString(value.theater_name, 300) || !boundedString(value.start_time, 80)
    || !Number.isFinite(Date.parse(value.start_time)) || formats === null
    || distance === undefined || runtime === undefined || bookingUrl === undefined
    || !(value.film_rating === undefined || value.film_rating === null || boundedString(value.film_rating, 40))
    || !(value.is_sold_out === undefined || typeof value.is_sold_out === "boolean")
  ) return null;
  return {
    id: value.id, filmId: value.film_id, filmTitle: value.film_title,
    filmRating: typeof value.film_rating === "string" ? value.film_rating : null,
    runtimeMinutes: runtime, cinemaId: value.theater_id, cinemaName: value.theater_name,
    startTime: value.start_time, formats, soldOut: value.is_sold_out ?? false,
    distanceKilometres: distance, bookingUrl,
  };
}

async function fetchPayload(
  url: URL,
  fetchImpl: FetchImplementation,
  apiKey: string | undefined,
  revalidate: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = new Headers({ accept: "application/json" });
    if (apiKey) headers.set("authorization", `Bearer ${apiKey}`);
    const response = await fetchImpl(url, {
      headers,
      signal: controller.signal,
      next: { revalidate },
    } as RequestInit & { next: { revalidate: number } });
    if (response.status === 429) throw new OpenCinemaClientError("UPSTREAM_BUSY");
    if (!response.ok) throw new OpenCinemaClientError("UPSTREAM_ERROR");
    return await response.json() as unknown;
  } catch (error) {
    if (error instanceof OpenCinemaClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new OpenCinemaClientError("UPSTREAM_TIMEOUT");
    throw new OpenCinemaClientError("UPSTREAM_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchScreenings(url: URL, fetchImpl: FetchImplementation, apiKey?: string): Promise<unknown[]> {
  const payload = await fetchPayload(url, fetchImpl, apiKey, SCREENING_REVALIDATE_SECONDS);
  return isRecord(payload) && Array.isArray(payload.screenings) ? payload.screenings.slice(0, 50) : [];
}

function buildCoverageUrl(): URL {
  const url = new URL(OPEN_CINEMA_THEATERS_URL);
  url.searchParams.set("lat", AUCKLAND_LATITUDE);
  url.searchParams.set("lon", AUCKLAND_LONGITUDE);
  url.searchParams.set("radius_km", "100");
  url.searchParams.set("limit", "1");
  return url;
}

export async function fetchAucklandCinemaCoverage({
  fetchImpl = fetch,
  apiKey,
}: {
  fetchImpl?: FetchImplementation;
  apiKey?: string;
} = {}): Promise<MovieCoverageState> {
  const payload = await fetchPayload(buildCoverageUrl(), fetchImpl, apiKey, COVERAGE_REVALIDATE_SECONDS);
  if (!isRecord(payload) || !Array.isArray(payload.theaters)
    || typeof payload.count !== "number" || !Number.isSafeInteger(payload.count) || payload.count < 0) {
    throw new OpenCinemaClientError("UPSTREAM_ERROR");
  }
  if ((payload.count === 0 && payload.theaters.length !== 0)
    || (payload.count > 0 && payload.theaters.length === 0)) {
    throw new OpenCinemaClientError("UPSTREAM_ERROR");
  }
  return payload.count > 0 ? "covered" : "not-covered";
}

export async function fetchAucklandScreenings(input: {
  query: string | null;
  date: MovieDateFilter;
  now: Date;
  fetchImpl?: FetchImplementation;
  apiKey?: string;
}): Promise<KiwiCueScreening[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const urls = buildOpenCinemaUrls(input);
  const payloads = await Promise.all(urls.map((url) => fetchScreenings(url, fetchImpl, input.apiKey)));
  const unique = new Map<string, KiwiCueScreening>();
  for (const value of payloads.flat()) {
    const screening = parseScreening(value);
    if (
      screening
      && Date.parse(screening.startTime) >= input.now.getTime()
      && !unique.has(screening.id)
    ) unique.set(screening.id, screening);
  }
  return [...unique.values()].sort((left, right) => Date.parse(left.startTime) - Date.parse(right.startTime));
}
