import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCandidates, type CandidateSources } from "../lib/ask/candidates";
import { EMPTY_FILTERS } from "../lib/ask/schema";
import type { KiwiCueEvent } from "../lib/events";
import type { KiwiCueScreening } from "../lib/movies";

const NOW = new Date("2026-09-30T23:00:00Z");

function event(id: string, name: string, localDate: string, overrides: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id, name, url: "https://www.ticketmaster.co.nz/x", imageUrl: "https://s1.ticketm.net/x.jpg",
    start: { localDate, localTime: "11:00:00", dateTime: `${localDate}T11:00:00+13:00`, timezone: "Pacific/Auckland" },
    status: "onsale", category: "Miscellaneous", tags: ["Family"],
    venue: { id: "v1", name: "Herald Theatre", city: "Auckland", address: "50 Mayoral Dr", postalCode: null, coordinates: { latitude: -36.85, longitude: 174.76 } },
    admission: { kind: "free", currency: "NZD" },
    ...overrides,
  };
}

function screening(id: string, title: string, cinemaId: string, startTime: string, filmRating = "PG"): KiwiCueScreening {
  return { id, filmId: "f", filmTitle: title, filmRating, runtimeMinutes: 100, cinemaId, cinemaName: `Cinema ${cinemaId}`, chain: "HOYTS",
    startTime, screenType: "Standard", formats: [], soldOut: false, discounted: false, bookingUrl: null, price: null };
}

const rockNight = event("c", "Rock Night", "2026-10-03", {
  category: "Music", tags: ["Rock"],
  venue: { id: "v2", name: "Spark Arena", city: "Auckland", address: "42 Mahuhu Cres", postalCode: null, coordinates: { latitude: -36.847, longitude: 174.779 } },
  admission: { kind: "range", currency: "NZD", min: 45, max: 80 },
  start: { localDate: "2026-10-03", localTime: "20:00:00", dateTime: "2026-10-03T20:00:00+13:00", timezone: "Pacific/Auckland" },
});

function sources(overrides: Partial<CandidateSources> = {}): CandidateSources {
  return {
    events: vi.fn(async () => [event("a", "Bundle Baby", "2026-10-03"), event("b", "Bundle Baby", "2026-10-04"), rockNight]),
    markets: vi.fn(() => [event("kc-market-x", "Night Market", "2026-10-03", { category: "Market", tags: [], imageUrl: "/markets/x.jpg" })]),
    movies: vi.fn(async () => [screening("m1", "Paw Patrol", "hoyts-1012", "2026-10-03T02:00:00.000Z"), screening("m2", "Paw Patrol", "hoyts-1002", "2026-10-03T03:00:00.000Z"),
      screening("m3", "Resident Evil", "event-502", "2026-10-03T08:00:00.000Z", "R16")]),
    ...overrides,
  };
}

describe("loadCandidates", () => {
  it("accepts a geographic movie place through its matching area", async () => {
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "movies", area: "central", place: "central Auckland" }, language: "en", now: NOW, sources: sources() });
    expect(result.cards.map((card) => card.title)).toEqual(["Resident Evil"]);
  });
  afterEach(() => vi.restoreAllMocks());

  it("groups repeat sessions and films into cards across all domains", async () => {
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, dates: ["2026-10-03", "2026-10-04"] }, language: "en", now: NOW, sources: sources() });
    expect(result.unavailable).toEqual([]);
    const byTitle = Object.fromEntries(result.cards.map((card) => [card.title, card]));
    expect(byTitle["Bundle Baby"]).toMatchObject({ kind: "event", id: "a", sessionCount: 2, priceText: "Free", href: "/events/a", venue: "Herald Theatre" });
    expect(byTitle["Rock Night"].priceText).toBe("From $45");
    expect(byTitle["Night Market"]).toMatchObject({ kind: "market", imageUrl: null });
    expect(byTitle["Paw Patrol"]).toMatchObject({ kind: "movie", sessionCount: 2, href: expect.stringContaining("/movies?q=Paw+Patrol&date=all") });
    // 2026-10-03 02:00Z (15:00 NZDT) Paw Patrol is after Bundle Baby at 11:00 NZDT, even though "…T02" < "…T11" as text.
    expect(result.cards.map((card) => card.title).slice(0, 3)).toEqual(["Bundle Baby", "Night Market", "Paw Patrol"]);
  });

  it("applies kids, evening, free and area filters", async () => {
    const kids = await loadCandidates({ filters: { ...EMPTY_FILTERS, kids: true }, language: "zh", now: NOW, sources: sources() });
    expect(kids.cards.map((card) => card.title).sort()).toEqual(["Bundle Baby", "Paw Patrol"]);
    expect(kids.cards.find((card) => card.title === "Bundle Baby")?.priceText).toBe("免费");

    const evening = await loadCandidates({ filters: { ...EMPTY_FILTERS, timeOfDay: "evening", domain: "events" }, language: "en", now: NOW, sources: sources() });
    expect(evening.cards.map((card) => card.title)).toEqual(["Rock Night"]);

    const free = await loadCandidates({ filters: { ...EMPTY_FILTERS, free: true }, language: "en", now: NOW, sources: sources() });
    expect(free.cards.map((card) => card.title).sort()).toEqual(["Bundle Baby", "Night Market"]);

    const east = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "movies", area: "east" }, language: "en", now: NOW, sources: sources() });
    expect(east.cards.map((card) => card.title)).toEqual(["Paw Patrol"]);
    expect(east.cards[0].sessionCount).toBe(2);
  });

  it("passes the first requested name to Ticketmaster and reports failed sources", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const events = vi.fn(async () => { throw new Error("down"); });
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, names: ["Sonu Nigam"] }, language: "en", now: NOW, sources: sources({ events }) });
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ start: NOW }), "Sonu Nigam");
    expect(result.unavailable).toEqual(["events"]);
    expect(result.cards.length).toBeGreaterThan(0);
  });

  it("keeps children suitability strict even beside a music category", async () => {
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", category: "music", kids: true }, language: "en", now: NOW, sources: sources() });
    expect(result.cards).toEqual([]);
    expect(result.relaxed).toEqual([]);
  });

  it("drops events whose cheapest ticket is over budget but keeps free and unknown prices", async () => {
    const unknown = event("d", "Mystery Gig", "2026-10-03", { admission: { kind: "unknown" } });
    const events = vi.fn(async () => [event("a", "Bundle Baby", "2026-10-03"), rockNight, unknown]);
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", maxPrice: 30 }, language: "en", now: NOW, sources: sources({ events }) });
    expect(result.cards.map((card) => card.title).sort()).toEqual(["Bundle Baby", "Mystery Gig"]);
  });

  it("never loosens a budget or time condition to fill results", async () => {
    const budget = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", category: "music", maxPrice: 30 }, language: "en", now: NOW, sources: sources() });
    expect(budget.cards).toEqual([]);
    expect(budget.relaxed).toEqual([]);

    const daytime = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", category: "music", timeOfDay: "day", maxPrice: 30 }, language: "en", now: NOW, sources: sources() });
    expect(daytime.cards).toEqual([]);
    expect(daytime.relaxed).toEqual([]);
  });

  it("keeps the chosen date and does not silently query nearby days", async () => {
    const all = sources();
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", category: "music", dates: ["2026-10-06"] }, language: "en", now: NOW, sources: all });
    expect(result.cards).toEqual([]);
    expect(result.relaxed).toEqual([]);
    expect(all.events).toHaveBeenCalledTimes(1);
  });

  it("returns nothing, with nothing relaxed, when there is truly nothing", async () => {
    const result = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", area: "west" }, language: "en", now: NOW, sources: sources({ events: vi.fn(async () => []) }) });
    expect(result).toEqual({ cards: [], relaxed: [], unavailable: [] });
  });

  it("does not substitute another location when the requested place has no matches", async () => {
    const near = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", place: "herald" }, language: "en", now: NOW, sources: sources() });
    expect(near.cards.map((card) => card.title)).toEqual(["Bundle Baby"]);
    const nowhere = await loadCandidates({ filters: { ...EMPTY_FILTERS, domain: "events", place: "Botany" }, language: "en", now: NOW, sources: sources() });
    expect(nowhere.cards).toHaveLength(0);
  });
});
