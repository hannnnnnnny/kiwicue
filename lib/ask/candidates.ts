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
import { logAskFailure } from "./log";
import { dateRange, widenDates } from "./resolve-dates";
import type { AskArea, AskCard, AskFilters } from "./schema";

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
const EVENING_HOUR = 17;

function aucklandHour(instant: string): number {
  return Number(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", hour: "2-digit", hourCycle: "h23" }).format(new Date(instant)));
}

function matchesTime(hour: number, filters: AskFilters): boolean {
  return filters.timeOfDay === "any" || (filters.timeOfDay === "evening" ? hour >= EVENING_HOUR : hour < EVENING_HOUR);
}

/** Event times carry an offset and film times are UTC, so compare instants rather than strings. */
export function byStartTime(left: Pick<AskCard, "when">, right: Pick<AskCard, "when">): number {
  const instant = (value: string) => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER; };
  return instant(left.when) - instant(right.when);
}

function eventStart(event: KiwiCueEvent): string {
  return event.start.dateTime ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}`;
}

function keepEvent(event: KiwiCueEvent, filters: AskFilters): boolean {
  const section = eventSectionId(event);
  const hour = event.start.localTime ? Number(event.start.localTime.slice(0, 2)) : 12;
  return (filters.dates.length === 0 || filters.dates.includes(event.start.localDate))
    && matchesTime(hour, filters)
    && (filters.area === "any" || deriveEventArea(event) === filters.area)
    && (filters.category === "any" || section === filters.category)
    // Beside a category, "with kids" is left to ranking: kids' music is still music.
    && (!filters.kids || filters.category !== "any" || section === "family")
    && (!filters.free || event.admission?.kind === "free")
    && (filters.maxPrice === null || event.admission?.kind !== "range" || event.admission.min <= filters.maxPrice);
}

/** Place is a soft filter: applied only when at least one event is at a matching venue. */
function applyPlace(events: KiwiCueEvent[], place: string | null): KiwiCueEvent[] {
  if (!place) return events;
  const needle = place.toLocaleLowerCase("en-NZ");
  const near = events.filter((event) => [event.venue?.name, event.venue?.address]
    .some((value) => value?.toLocaleLowerCase("en-NZ").includes(needle)));
  return near.length > 0 ? near : events;
}

function priceText(event: KiwiCueEvent, language: Language): string | null {
  if (event.admission?.kind === "free") return language === "zh" ? "免费" : "Free";
  if (event.admission?.kind === "range") return language === "zh" ? `$${event.admission.min} 起` : `From $${event.admission.min}`;
  return null;
}

function eventCards(events: KiwiCueEvent[], language: Language): AskCard[] {
  return groupEventSeries(events).map(({ lead, events: sessions }) => ({
    kind: lead.id.startsWith(MARKET_PREFIX) ? "market" : "event",
    id: lead.id, title: lead.name, when: eventStart(lead), venue: lead.venue?.name ?? null,
    href: `/events/${encodeURIComponent(lead.id)}`,
    imageUrl: lead.imageUrl?.startsWith("https://") ? lead.imageUrl : null,
    priceText: priceText(lead, language), sessionCount: sessions.length, score: 0,
  }));
}

function keepScreening(screening: KiwiCueScreening, filters: AskFilters): boolean {
  return (filters.dates.length === 0 || filters.dates.includes(aucklandDate(new Date(screening.startTime))))
    && matchesTime(aucklandHour(screening.startTime), filters)
    && (filters.area === "any" || CINEMA_AREAS[screening.cinemaId] === filters.area)
    && (!filters.kids || KIDS_RATINGS.has(screening.filmRating ?? ""));
}

function movieCards(screenings: KiwiCueScreening[]): AskCard[] {
  const films = new Map<string, KiwiCueScreening[]>();
  for (const screening of screenings) {
    const key = normalizedMovieTitle(screening.filmTitle);
    films.set(key, [...(films.get(key) ?? []), screening]);
  }
  return [...films].map(([key, sessions]) => {
    const next = [...sessions].sort((left, right) => left.startTime.localeCompare(right.startTime))[0];
    return {
      kind: "movie" as const, id: `movie:${key}`.slice(0, 200), title: next.filmTitle, when: next.startTime, venue: next.cinemaName,
      href: `/movies?q=${encodeURIComponent(next.filmTitle)}`, imageUrl: null, priceText: null, sessionCount: sessions.length, score: 0,
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

/** Filters to loosen when nothing matches, least important first. Domain, names and place stay. */
const RELAX_ORDER = ["maxPrice", "area", "timeOfDay", "kids", "category", "free"] as const;
type Relaxable = (typeof RELAX_ORDER)[number];
const LOOSE: Pick<AskFilters, Relaxable> = { maxPrice: null, area: "any", timeOfDay: "any", kids: false, category: "any", free: false };

function cardsFor(raw: Raw, filters: AskFilters, language: Language, now: Date): AskCard[] {
  const upcoming = raw.events.filter((event) => !event.start.dateTime || Date.parse(event.start.dateTime) >= now.getTime());
  const cards = [
    ...eventCards(applyPlace(upcoming.filter((event) => keepEvent(event, filters)), filters.place), language),
    ...movieCards(raw.screenings.filter((screening) => Date.parse(screening.startTime) >= now.getTime() && keepScreening(screening, filters))),
  ];
  return cards.sort(byStartTime).slice(0, MAX_CANDIDATES);
}

/** The exact match, or the first step of the ladder that finds something. */
function relaxWithin(raw: Raw, filters: AskFilters, language: Language, now: Date): { cards: AskCard[]; relaxed: Relaxable[] } {
  let current = filters;
  const relaxed: Relaxable[] = [];
  let cards = cardsFor(raw, current, language, now);
  for (const key of RELAX_ORDER) {
    if (cards.length > 0) break;
    if (current[key] === LOOSE[key]) continue;
    current = { ...current, [key]: LOOSE[key] };
    relaxed.push(key);
    cards = cardsFor(raw, current, language, now);
  }
  return cards.length > 0 ? { cards, relaxed } : { cards: [], relaxed: [] };
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
  const exactDays = relaxWithin(await fetchRaw(filters, now, sources, unavailable), filters, language, now);
  if (exactDays.cards.length > 0 || filters.dates.length === 0) return { ...exactDays, unavailable };
  // Nearby days need a fresh fetch: Ticketmaster is queried by date range.
  const nearby = { ...filters, dates: widenDates(filters.dates, now) };
  const nearbyDays = relaxWithin(await fetchRaw(nearby, now, sources, []), nearby, language, now);
  return nearbyDays.cards.length > 0 ? { cards: nearbyDays.cards, relaxed: ["dates", ...nearbyDays.relaxed], unavailable } : { cards: [], relaxed: [], unavailable };
}
