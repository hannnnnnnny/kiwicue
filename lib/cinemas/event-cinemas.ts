import "server-only";
import type { KiwiCueScreening } from "../movies";
import { aucklandLocalToIso } from "./auckland-time";
import { boundedInteger, boundedString, fetchCinemaJson, isRecord, type FetchImplementation } from "./source-fetch";

const SESSIONS_URL = "https://www.eventcinemas.co.nz/Cinemas/GetSessions";
const SESSION_REVALIDATE_SECONDS = 900;
const MAX_MOVIES_PER_DAY = 200;
const MAX_SESSIONS_PER_CINEMA_DAY = 60;

export const EVENT_AUCKLAND_CINEMAS: ReadonlyArray<{ id: number; name: string }> = [
  { id: 504, name: "EVENT Cinemas Albany" },
  { id: 507, name: "EVENT Cinemas Manukau" },
  { id: 520, name: "EVENT Cinemas Newmarket" },
  { id: 502, name: "EVENT Cinemas Queen Street" },
  { id: 509, name: "EVENT Cinemas St Lukes" },
  { id: 506, name: "EVENT Cinemas Westcity" },
  { id: 505, name: "EVENT Cinemas Westgate" },
];
const CINEMA_NAMES = new Map(EVENT_AUCKLAND_CINEMAS.map(({ id, name }) => [id, name]));
const HALF_PRICE_CODE = "Half-Price";
// Experience attributes (TypeId 2) such as 4K or Dolby Atmos; accessibility aids are left to the booking page.
const EXPERIENCE_ATTRIBUTE_TYPE = 2;

export function buildEventSessionsUrl(date: string): URL {
  const url = new URL(SESSIONS_URL);
  for (const { id } of EVENT_AUCKLAND_CINEMAS) url.searchParams.append("cinemaIds", String(id));
  url.searchParams.set("date", date);
  return url;
}

type EventFilm = { id: number; title: string; rating: string | null; runtimeMinutes: number | null };

function attributes(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord).slice(0, 20) : [];
}

function bookingUrl(value: unknown): string | null {
  if (!boundedString(value, 300)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.eventcinemas.co.nz" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseSession(value: unknown, film: EventFilm, cinemaName: string): KiwiCueScreening | null {
  if (!isRecord(value) || !boundedInteger(value.Id, Number.MAX_SAFE_INTEGER) || !boundedInteger(value.CinemaId, 100_000)
    || !boundedString(value.StartTime, 40)) return null;
  const startTime = aucklandLocalToIso(value.StartTime);
  if (!startTime) return null;
  const sessionAttributes = attributes(value.Attributes);
  return {
    id: `event-${value.Id}`, filmId: `event-${film.id}`, filmTitle: film.title, filmRating: film.rating,
    runtimeMinutes: film.runtimeMinutes, cinemaId: `event-${value.CinemaId}`, cinemaName, chain: "EVENT Cinemas", startTime,
    screenType: boundedString(value.ScreenTypeName, 40) && value.ScreenTypeName !== "Original" ? value.ScreenTypeName : "Standard",
    formats: sessionAttributes.filter((item) => item.TypeId === EXPERIENCE_ATTRIBUTE_TYPE && boundedString(item.Name, 40))
      .map((item) => item.Name as string),
    soldOut: value.SeatsAvailable === 0,
    discounted: sessionAttributes.some((item) => item.Code === HALF_PRICE_CODE),
    bookingUrl: bookingUrl(value.BookingUrl), price: null,
  };
}

function parseFilm(value: unknown): KiwiCueScreening[] {
  if (!isRecord(value) || !boundedInteger(value.Id, Number.MAX_SAFE_INTEGER) || !boundedString(value.Name, 300)) return [];
  const film: EventFilm = {
    id: value.Id, title: value.Name.trim(),
    rating: boundedString(value.Rating, 20) ? value.Rating : null,
    runtimeMinutes: boundedInteger(value.RunningTime, 1_000) && value.RunningTime > 0 ? value.RunningTime : null,
  };
  const cinemas = Array.isArray(value.CinemaModels) ? value.CinemaModels.filter(isRecord) : [];
  return cinemas.flatMap((cinema) => {
    const name = typeof cinema.Id === "number" ? CINEMA_NAMES.get(cinema.Id) : undefined;
    if (!name || !Array.isArray(cinema.Sessions)) return [];
    return cinema.Sessions.slice(0, MAX_SESSIONS_PER_CINEMA_DAY)
      .map((session) => parseSession(session, film, name))
      .filter((session): session is KiwiCueScreening => session !== null);
  });
}

export function parseEventSessions(payload: unknown): KiwiCueScreening[] {
  if (!isRecord(payload) || payload.Success !== true || !isRecord(payload.Data) || !Array.isArray(payload.Data.Movies)) return [];
  return payload.Data.Movies.slice(0, MAX_MOVIES_PER_DAY).flatMap(parseFilm);
}

export async function fetchEventScreenings(input: { dates: string[]; fetchImpl?: FetchImplementation }): Promise<KiwiCueScreening[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const payloads = await Promise.all(input.dates.map((date) =>
    fetchCinemaJson(buildEventSessionsUrl(date), fetchImpl, SESSION_REVALIDATE_SECONDS)));
  return payloads.flatMap(parseEventSessions);
}
