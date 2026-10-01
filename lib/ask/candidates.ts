import "server-only";
import { aucklandDate } from "../cinemas/auckland-time";
import { fetchAucklandSessions } from "../cinemas/auckland-sessions";
import { listCuratedMarkets } from "../curated-markets";
import { deriveEventArea } from "../event-discovery";
import { eventSectionId, groupEventSeries } from "../event-series";
import type { KiwiCueEvent } from "../events";
import type { KiwiCueScreening } from "../movies";
import { fetchAucklandEvents } from "../ticketmaster";
import { normalizedMovieTitle } from "../verified-movie-sessions";
import { byStartTime } from "./card-order";
import { logAskFailure } from "./log";
import { dateRange } from "./resolve-dates";
import type { AskArea, AskCard, AskFilters } from "./schema";
import { aucklandMinute, localMinute, matchesTimeWindow } from "./time-window";
import { priceEvidence } from "./price-evidence";
import { movieResultHref, trustedBookingUrl } from "./booking";

export { byStartTime };
export const MAX_CANDIDATES = 40;
export type CandidateSources = {
  events(range: { start: Date; end: Date }, keyword: string | null): Promise<KiwiCueEvent[]>;
  markets(now: Date): KiwiCueEvent[];
  movies(now: Date): Promise<KiwiCueScreening[]>;
};
/** `relaxed` lists the chip keys that had to be dropped to find anything; empty for exact matches. */
export type CandidateResult = { cards: AskCard[]; relaxed: string[]; unavailable: Array<"events" | "movies"> };
type Language = "en" | "zh";

export const defaultSources: CandidateSources = {
  async events(range, keyword) {
    return (await fetchAucklandEvents({ startDateTime: range.start, endDateTime: range.end, size: 50, keyword })).events;
  },
  markets: (now) => listCuratedMarkets({ now, size: 50 }).events,
  async movies(now) { return (await fetchAucklandSessions({ date: "all", now })).screenings; },
};

// Area of each covered cinema, using the same north/central/east/south/west split as events.
const CINEMA_AREAS: Record<string, AskArea> = {
  "hoyts-1013": "east", "hoyts-1012": "east", "hoyts-1011": "north", "hoyts-ORMCIN": "south", "hoyts-1002": "east", "hoyts-1001": "north",
  "event-504": "north", "event-507": "south", "event-520": "central", "event-502": "central", "event-509": "central", "event-506": "west", "event-505": "west",
};
const KIDS_RATINGS = new Set(["G", "PG"]);
const MARKET_PREFIX = "kc-market-";

function eventStart(event: KiwiCueEvent): string {
  return event.start.dateTime ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}`;
}

function keepEvent(event: KiwiCueEvent, filters: AskFilters): boolean {
  const section = eventSectionId(event);
  const unavailable = /^(cancelled|canceled|postponed|rescheduled|offsale|soldout|sold_out)$/iu.test(event.status);
  const price = priceEvidence({ min: event.admission?.kind === "range" ? event.admission.min : null,
    max: event.admission?.kind === "range" ? event.admission.max : null, free: event.admission?.kind === "free" }, filters);
  return !unavailable && price.keep && (filters.dates.length === 0 || filters.dates.includes(event.start.localDate))
    && matchesTimeWindow(localMinute(event.start.localTime), filters)
    && (filters.area === "any" || deriveEventArea(event) === filters.area)
    && (filters.category === "any" || section === filters.category)
    && (!filters.kids || section === "family");
}

/** Never silently substitute a different place when nothing matches. */
function applyPlace(events: KiwiCueEvent[], place: string | null): KiwiCueEvent[] {
  if (!place || /^(central auckland|auckland central|cbd|north shore|奥克兰市中心|市中心)$/iu.test(place.trim())) return events;
  const needle = place.toLocaleLowerCase("en-NZ");
  const near = events.filter((event) => [event.venue?.name, event.venue?.address]
    .some((value) => value?.toLocaleLowerCase("en-NZ").includes(needle)));
  return near;
}

function priceText(event: KiwiCueEvent, language: Language): string | null {
  if (event.admission?.kind === "free") return language === "zh" ? "免费" : "Free";
  if (event.admission?.kind === "range") return language === "zh" ? `$${event.admission.min} 起` : `From $${event.admission.min}`;
  return null;
}

function eventCards(events: KiwiCueEvent[], language: Language, filters: AskFilters): AskCard[] {
  return groupEventSeries(events).map(({ lead, events: sessions }) => ({
    kind: lead.id.startsWith(MARKET_PREFIX) ? "market" : "event",
    id: lead.id, title: lead.name, when: eventStart(lead), venue: lead.venue?.name ?? null,
    href: `/events/${encodeURIComponent(lead.id)}`,
    imageUrl: lead.imageUrl?.startsWith("https://") ? lead.imageUrl : null,
    priceText: priceText(lead, language), sessionCount: sessions.length, score: 0,
    bookingUrl: trustedBookingUrl(lead.url),
    budgetStatus: priceEvidence({ min: lead.admission?.kind === "range" ? lead.admission.min : null,
      max: lead.admission?.kind === "range" ? lead.admission.max : null, free: lead.admission?.kind === "free" }, filters).budgetStatus,
    minPartyCost: priceEvidence({ min: lead.admission?.kind === "range" ? lead.admission.min : null,
      max: null, free: lead.admission?.kind === "free" }, filters).minPartyCost,
    durationMinutes: null,
  }));
}

function keepScreening(screening: KiwiCueScreening, filters: AskFilters): boolean {
  const price = priceEvidence({ min: screening.price ? screening.price.minCents / 100 : null,
    max: screening.price ? screening.price.maxCents / 100 : null, free: false }, filters);
  const place = filters.place?.toLocaleLowerCase("en-NZ");
  const geographicPlace = /^(central(?: auckland)?|auckland cbd|cbd|north shore)$/iu.test(place ?? "");
  return !screening.soldOut && price.keep
    && (filters.names.length === 0 || filters.names.some((name) => normalizedMovieTitle(screening.filmTitle).includes(normalizedMovieTitle(name))))
    && (!place || geographicPlace || screening.cinemaName.toLocaleLowerCase("en-NZ").includes(place))
    && (filters.dates.length === 0 || filters.dates.includes(aucklandDate(new Date(screening.startTime))))
    && matchesTimeWindow(aucklandMinute(screening.startTime), filters)
    && (filters.area === "any" || CINEMA_AREAS[screening.cinemaId] === filters.area)
    && (!filters.kids || KIDS_RATINGS.has(screening.filmRating ?? ""));
}

function movieCards(screenings: KiwiCueScreening[], filters: AskFilters): AskCard[] {
  const films = new Map<string, KiwiCueScreening[]>();
  for (const screening of screenings) {
    const key = normalizedMovieTitle(screening.filmTitle);
    films.set(key, [...(films.get(key) ?? []), screening]);
  }
  return [...films].map(([key, sessions]) => {
    const next = [...sessions].sort((left, right) => left.startTime.localeCompare(right.startTime))[0];
    return {
      kind: "movie" as const, id: `movie:${key}`.slice(0, 200), title: next.filmTitle, when: next.startTime, venue: next.cinemaName,
      href: movieResultHref(next.filmTitle, next.startTime, next.cinemaId), imageUrl: null,
      priceText: next.price ? `From $${(next.price.minCents / 100).toFixed(2)}` : null, sessionCount: sessions.length, score: 0,
      bookingUrl: trustedBookingUrl(next.bookingUrl),
      budgetStatus: priceEvidence({ min: next.price ? next.price.minCents / 100 : null, max: null, free: false }, filters).budgetStatus,
      minPartyCost: priceEvidence({ min: next.price ? next.price.minCents / 100 : null, max: null, free: false }, filters).minPartyCost,
      durationMinutes: next.runtimeMinutes, indoor: true,
    };
  });
}

function wants(filters: AskFilters, domain: "events" | "movies" | "markets"): boolean {
  if (filters.domain !== "any") return filters.domain === domain;
  // Films carry no category or price to filter on, so a category or free-only ask skips them.
  return domain !== "movies" || (filters.category === "any" && !filters.free);
}

async function settle<T>(source: "events" | "movies", load: () => Promise<T[]>, unavailable: CandidateResult["unavailable"]): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    logAskFailure("source", error);
    unavailable.push(source);
    return [];
  }
}

type Raw = { events: KiwiCueEvent[]; screenings: KiwiCueScreening[] };

function cardsFor(raw: Raw, filters: AskFilters, language: Language, now: Date): AskCard[] {
  const upcoming = raw.events.filter((event) => !event.start.dateTime || Date.parse(event.start.dateTime) >= now.getTime());
  const cards = [
    ...eventCards(applyPlace(upcoming.filter((event) => keepEvent(event, filters)), filters.place), language, filters),
    ...movieCards(raw.screenings.filter((screening) => Date.parse(screening.startTime) >= now.getTime() && keepScreening(screening, filters)), filters),
  ];
  return cards.sort(byStartTime).slice(0, MAX_CANDIDATES);
}

async function fetchRaw(filters: AskFilters, now: Date, sources: CandidateSources, unavailable: CandidateResult["unavailable"]): Promise<Raw> {
  const [events, screenings] = await Promise.all([
    wants(filters, "events") ? settle("events", () => sources.events(dateRange(filters.dates, now), filters.names[0] ?? null), unavailable) : [],
    wants(filters, "movies") ? settle("movies", () => sources.movies(now), unavailable) : [],
  ]);
  const markets = wants(filters, "markets") ? sources.markets(now) : [];
  return { events: [...events, ...markets], screenings };
}

export async function loadCandidates(input: { filters: AskFilters; language: Language; now: Date; sources?: CandidateSources }): Promise<CandidateResult> {
  const { filters, language, now } = input;
  const sources = input.sources ?? defaultSources;
  const unavailable: CandidateResult["unavailable"] = [];
  const cards = cardsFor(await fetchRaw(filters, now, sources, unavailable), filters, language, now);
  return { cards, relaxed: [], unavailable };
}
