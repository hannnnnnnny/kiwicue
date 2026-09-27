import "server-only";
import type { KiwiCueScreening, ScreeningPrice } from "../movies";
import { aucklandDate } from "./auckland-time";
import {
  boundedInteger, boundedString, fetchCinemaJson, isRecord, mapWithConcurrency, type FetchImplementation,
} from "./source-fetch";

const API = "https://apim.hoyts.co.nz/nz";
const SITE = "https://www.hoyts.co.nz";
const SESSION_REVALIDATE_SECONDS = 900;
const FILM_REVALIDATE_SECONDS = 3_600;
const PRICE_REVALIDATE_SECONDS = 3_600;
const MAX_SESSIONS_PER_CINEMA = 1_500;
const MAX_PRICE_LOOKUPS = 30;
const PRICE_CONCURRENCY = 6;

export const HOYTS_AUCKLAND_CINEMAS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "1013", name: "HOYTS Berkeley Mission Bay" },
  { id: "1012", name: "HOYTS Botany Downs" },
  { id: "1011", name: "HOYTS Hibiscus Coast" },
  { id: "ORMCIN", name: "HOYTS Ormiston" },
  { id: "1002", name: "HOYTS Sylvia Park" },
  { id: "1001", name: "HOYTS Wairau Park" },
];

const SCREEN_TYPES: Record<string, string> = { STANDARD: "Standard", LUX: "LUX", XTREME: "Xtremescreen" };
// Tickets a general visitor cannot simply buy at this price (birthday comps, minimum-group family deals).
const EXCLUDED_TICKET = /complimentary|bday|birthday|family|companion|carer/iu;

type HoytsFilm = { title: string; rating: string | null; runtimeMinutes: number | null };

function parseFilm(value: unknown): [string, HoytsFilm] | null {
  if (!isRecord(value) || !boundedString(value.vistaId, 64) || !boundedString(value.name, 300)) return null;
  const runtime = [value.duration, isRecord(value.runtime) ? value.runtime.minutes : undefined]
    .find((minutes): minutes is number => boundedInteger(minutes, 1_000) && minutes > 0) ?? null;
  const rating = isRecord(value.rating) && boundedString(value.rating.id, 20) && value.rating.id !== "TBC" ? value.rating.id : null;
  return [value.vistaId, { title: value.name.trim(), rating, runtimeMinutes: runtime }];
}

async function fetchFilms(fetchImpl: FetchImplementation): Promise<Map<string, HoytsFilm>> {
  const payload = await fetchCinemaJson(new URL(`${API}/cinemaapi/api/movies`), fetchImpl, FILM_REVALIDATE_SECONDS);
  if (!Array.isArray(payload)) return new Map();
  return new Map(payload.map(parseFilm).filter((entry): entry is [string, HoytsFilm] => entry !== null));
}

function bookingUrl(link: unknown): string | null {
  if (!boundedString(link, 300) || !link.startsWith("/orders/tickets?")) return null;
  return `${SITE}${link}`;
}

function parseSession(value: unknown, cinemaName: string, films: Map<string, HoytsFilm>): KiwiCueScreening | null {
  if (!isRecord(value) || !boundedInteger(value.id, Number.MAX_SAFE_INTEGER) || !boundedString(value.cinemaId, 32)
    || !boundedString(value.movieId, 64) || !boundedString(value.utcDate, 40) || !Number.isFinite(Date.parse(value.utcDate))
    || !boundedString(value.typeId, 40)) return null;
  const film = films.get(value.movieId);
  if (!film) return null;
  return {
    id: `hoyts-${value.cinemaId}-${value.id}`, filmId: `hoyts-${value.movieId}`, filmTitle: film.title,
    filmRating: film.rating, runtimeMinutes: film.runtimeMinutes, cinemaId: `hoyts-${value.cinemaId}`, cinemaName,
    chain: "HOYTS", startTime: new Date(value.utcDate).toISOString(),
    screenType: SCREEN_TYPES[value.typeId] ?? value.typeId, formats: [],
    soldOut: value.disabled === true, discounted: value.discount === true, bookingUrl: bookingUrl(value.link), price: null,
  };
}

async function fetchCinemaSessions(
  cinema: { id: string; name: string }, films: Map<string, HoytsFilm>, fetchImpl: FetchImplementation,
): Promise<KiwiCueScreening[]> {
  const url = new URL(`${API}/cinemaapi/api/sessions/${encodeURIComponent(cinema.id)}`);
  const payload = await fetchCinemaJson(url, fetchImpl, SESSION_REVALIDATE_SECONDS);
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, MAX_SESSIONS_PER_CINEMA)
    .map((session) => parseSession(session, cinema.name, films))
    .filter((session): session is KiwiCueScreening => session !== null);
}

export async function fetchHoytsScreenings(input: { dates: string[]; fetchImpl?: FetchImplementation }): Promise<KiwiCueScreening[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const films = await fetchFilms(fetchImpl);
  const perCinema = await Promise.all(HOYTS_AUCKLAND_CINEMAS.map((cinema) => fetchCinemaSessions(cinema, films, fetchImpl)));
  const dates = new Set(input.dates);
  return perCinema.flat().filter((session) => dates.has(aucklandDate(new Date(session.startTime))));
}

export function parseHoytsPrice(payload: unknown): ScreeningPrice | null {
  if (!isRecord(payload) || !Array.isArray(payload.ticketTypes)) return null;
  const tickets = payload.ticketTypes.filter((ticket): ticket is Record<string, unknown> => isRecord(ticket)
    && boundedString(ticket.name, 120) && !EXCLUDED_TICKET.test(ticket.name)
    && ticket.isShowToNonLoyaltyMembers !== true && ticket.isThirdPartyMemberTicket !== true
    && boundedInteger(ticket.priceInCents, 100_000) && ticket.priceInCents > 0);
  if (tickets.length === 0) return null;
  // Group tickets ("Daybed - 3 People") price several seats at once; compare per person.
  const seats = (ticket: Record<string, unknown>) => boundedInteger(ticket.seats, 20) && ticket.seats > 0 ? ticket.seats : 1;
  const prices = tickets.map((ticket) => Math.round((ticket.priceInCents as number) / seats(ticket)));
  const fees = tickets.filter((ticket) => boundedInteger(ticket.bookingFeeInCents, 10_000))
    .map((ticket) => Math.round((ticket.bookingFeeInCents as number) / seats(ticket)));
  return { minCents: Math.min(...prices), maxCents: Math.max(...prices), bookingFeeCents: fees.length > 0 ? Math.max(...fees) : null };
}

function priceKey(session: KiwiCueScreening): string {
  return `${session.cinemaId}|${session.screenType}|${session.discounted}`;
}

/**
 * HOYTS publishes prices per session. One lookup per cinema, screen type and discount flag is
 * enough to show each cinema's price range without a request for every session, so only the
 * sampled sessions carry a price and the UI presents it as a per-cinema range.
 */
export async function attachHoytsPrices(sessions: KiwiCueScreening[], fetchImpl: FetchImplementation = fetch): Promise<KiwiCueScreening[]> {
  const samples = new Map<string, KiwiCueScreening>();
  for (const session of sessions) {
    if (session.chain === "HOYTS" && !session.soldOut && !samples.has(priceKey(session))) samples.set(priceKey(session), session);
  }
  const picked = [...samples.values()].slice(0, MAX_PRICE_LOOKUPS);
  const prices = await mapWithConcurrency(picked, PRICE_CONCURRENCY, async (session) => {
    const [cinemaId, sessionId] = [session.cinemaId.replace(/^hoyts-/u, ""), session.id.split("-").at(-1) ?? ""];
    const url = new URL(`${API}/ticketing/api/v1/ticket/${encodeURIComponent(cinemaId)}/${encodeURIComponent(sessionId)}`);
    try {
      return parseHoytsPrice(await fetchCinemaJson(url, fetchImpl, PRICE_REVALIDATE_SECONDS));
    } catch {
      return null; // A missing price only hides the price line; sessions stay useful.
    }
  });
  const byId = new Map(picked.map((session, index) => [session.id, prices[index]]));
  return sessions.map((session) => byId.has(session.id) ? { ...session, price: byId.get(session.id) ?? null } : session);
}
