import { describe, expect, it, vi } from "vitest";
import { fetchAucklandSessions } from "../lib/cinemas/auckland-sessions";
import { aucklandLocalToIso, datesForFilter } from "../lib/cinemas/auckland-time";
import { buildEventSessionsUrl, parseEventSessions } from "../lib/cinemas/event-cinemas";
import { attachHoytsPrices, fetchHoytsScreenings, parseHoytsPrice } from "../lib/cinemas/hoyts";
import type { KiwiCueScreening } from "../lib/movies";

const NOW = new Date("2026-09-28T00:00:00.000Z"); // Monday 28 Sep, 1pm in Auckland (NZDT)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const hoytsFilms = [
  { vistaId: "HO1", name: "Heart Of The Beast", duration: 100, runtime: { minutes: 0 }, rating: { id: "M" } },
  { vistaId: "HO2", name: "Coming Later", duration: 0, runtime: { minutes: 0 }, rating: { id: "TBC" } },
];

function hoytsSession(overrides: Record<string, unknown>) {
  return {
    id: 503255, cinemaId: "1002", movieId: "HO1", date: "2026-09-28T19:30:00", utcDate: "2026-09-28T06:30:00+00:00",
    typeId: "STANDARD", disabled: false, discount: false, link: "/orders/tickets?cinemaId=1002&sessionId=503255",
    ...overrides,
  };
}

function hoytsFetch(sessions: Record<string, unknown[]>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/cinemaapi/api/movies")) return json(hoytsFilms);
    const cinemaId = url.split("/sessions/")[1];
    return json(sessions[cinemaId] ?? []);
  });
}

describe("Auckland time helpers", () => {
  it("maps date filters to Auckland calendar days", () => {
    expect(datesForFilter("today", NOW)).toEqual(["2026-09-28"]);
    expect(datesForFilter("tomorrow", NOW)).toEqual(["2026-09-29"]);
    expect(datesForFilter("weekend", NOW)).toEqual(["2026-10-03", "2026-10-04"]);
    expect(datesForFilter("all", NOW)).toHaveLength(7);
  });

  it("converts cinema wall-clock times to instants on both sides of daylight saving", () => {
    expect(aucklandLocalToIso("2026-09-29T19:30")).toBe("2026-09-29T06:30:00.000Z"); // NZDT, UTC+13
    expect(aucklandLocalToIso("2026-07-01T19:30")).toBe("2026-07-01T07:30:00.000Z"); // NZST, UTC+12
    expect(aucklandLocalToIso("29/09/2026 7:30pm")).toBeNull();
  });
});

describe("HOYTS source", () => {
  it("normalises Auckland sessions, keeps the requested dates and skips unknown films", async () => {
    const fetchImpl = hoytsFetch({
      "1002": [
        hoytsSession({}),
        hoytsSession({ id: 2, typeId: "LUX", discount: true, utcDate: "2026-09-28T08:00:00+00:00", link: "/orders/tickets?cinemaId=1002&sessionId=2" }),
        hoytsSession({ id: 3, utcDate: "2026-10-02T06:30:00+00:00" }),
        hoytsSession({ id: 4, movieId: "UNKNOWN" }),
        hoytsSession({ id: 5, link: "https://evil.example/orders/tickets?x" }),
      ],
    });
    const sessions = await fetchHoytsScreenings({ dates: ["2026-09-28"], fetchImpl });

    expect(sessions.map((session) => session.id)).toEqual(["hoyts-1002-503255", "hoyts-1002-2", "hoyts-1002-5"]);
    expect(sessions[0]).toMatchObject({
      filmTitle: "Heart Of The Beast", filmRating: "M", runtimeMinutes: 100, cinemaName: "HOYTS Sylvia Park",
      chain: "HOYTS", startTime: "2026-09-28T06:30:00.000Z", screenType: "Standard",
      bookingUrl: "https://www.hoyts.co.nz/orders/tickets?cinemaId=1002&sessionId=503255",
    });
    expect(sessions[1]).toMatchObject({ screenType: "LUX", discounted: true });
    expect(sessions[2].bookingUrl).toBeNull();
  });

  it("summarises public ticket prices and ignores member-only, complimentary and family tickets", () => {
    expect(parseHoytsPrice({ ticketTypes: [
      { name: "STND Adult", priceInCents: 2400, bookingFeeInCents: 180 },
      { name: "STND Senior", priceInCents: 1900, bookingFeeInCents: 180 },
      { name: "Complimentary Adult Bday", priceInCents: 0, bookingFeeInCents: 180 },
      { name: "Family Ticket Min. 3 STND", priceInCents: 1450, bookingFeeInCents: 180 },
      { name: "VIP Ticket", priceInCents: 1650, bookingFeeInCents: 180, isShowToNonLoyaltyMembers: true },
    ] })).toEqual({ minCents: 1900, maxCents: 2400, bookingFeeCents: 180 });
    expect(parseHoytsPrice({ ticketTypes: [
      { name: "Adult", priceInCents: 2600, bookingFeeInCents: 180, seats: 1 },
      { name: "Daybed - 1 Person", priceInCents: 4150, bookingFeeInCents: 180, seats: 1 },
      { name: "Daybed - 3 People", priceInCents: 6300, bookingFeeInCents: 540, seats: 3 },
    ] })).toEqual({ minCents: 2100, maxCents: 4150, bookingFeeCents: 180 });
    expect(parseHoytsPrice({ ticketTypes: [] })).toBeNull();
    expect(parseHoytsPrice("nope")).toBeNull();
  });

  it("looks up one price per cinema and screen type, and survives a failed lookup", async () => {
    const base = { filmId: "hoyts-HO1", filmTitle: "Film", filmRating: null, runtimeMinutes: 100, cinemaName: "HOYTS Sylvia Park",
      chain: "HOYTS" as const, startTime: "2026-09-28T06:30:00.000Z", formats: [], soldOut: false, discounted: false, bookingUrl: null, price: null };
    const sessions: KiwiCueScreening[] = [
      { ...base, id: "hoyts-1002-1", cinemaId: "hoyts-1002", screenType: "Standard" },
      { ...base, id: "hoyts-1002-2", cinemaId: "hoyts-1002", screenType: "Standard" },
      { ...base, id: "hoyts-1002-3", cinemaId: "hoyts-1002", screenType: "LUX" },
      { ...base, id: "event-9", cinemaId: "event-502", chain: "EVENT Cinemas", screenType: "Standard" },
    ];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/1002/3")
      ? json({}, 500)
      : json({ ticketTypes: [{ name: "STND Adult", priceInCents: 2400, bookingFeeInCents: 180 }] }));

    const priced = await attachHoytsPrices(sessions, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("https://apim.hoyts.co.nz/nz/ticketing/api/v1/ticket/1002/1");
    expect(priced.map((session) => session.price)).toEqual([
      { minCents: 2400, maxCents: 2400, bookingFeeCents: 180 }, null, null, null,
    ]);
  });
});

describe("EVENT Cinemas source", () => {
  it("requests every Auckland cinema for one date", () => {
    const url = buildEventSessionsUrl("2026-09-29");
    expect(url.searchParams.getAll("cinemaIds")).toEqual(["504", "507", "520", "502", "509", "506", "505"]);
    expect(url.searchParams.get("date")).toBe("2026-09-29");
  });

  it("normalises sessions, screen types, half-price flags and booking links", () => {
    const sessions = parseEventSessions({ Success: true, Data: { Movies: [{
      Id: 21413, Name: "Heart Of The Beast", Rating: "M", RunningTime: 100,
      CinemaModels: [
        { Id: 502, Sessions: [
          { Id: 1, CinemaId: 502, StartTime: "2026-09-29T11:00", ScreenTypeName: "Original", SeatsAvailable: 144,
            BookingUrl: "https://www.eventcinemas.co.nz/orders/tickets#sessionId=1",
            Attributes: [{ Name: "Half-Price", Code: "Half-Price", TypeId: 1 }, { Name: "4K", Code: "4K", TypeId: 2 }] },
          { Id: 2, CinemaId: 502, StartTime: "2026-09-29T19:00", ScreenTypeName: "Gold Class", SeatsAvailable: 0,
            BookingUrl: "https://evil.example/tickets", Attributes: [] },
          { Id: 3, CinemaId: 502, StartTime: "not a time" },
        ] },
        { Id: 999, Sessions: [{ Id: 4, CinemaId: 999, StartTime: "2026-09-29T11:00" }] },
      ],
    }] } });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({
      id: "event-1", cinemaName: "EVENT Cinemas Queen Street", chain: "EVENT Cinemas", startTime: "2026-09-28T22:00:00.000Z",
      screenType: "Standard", formats: ["4K"], discounted: true, soldOut: false,
      bookingUrl: "https://www.eventcinemas.co.nz/orders/tickets#sessionId=1", price: null,
    });
    expect(sessions[1]).toMatchObject({ screenType: "Gold Class", soldOut: true, bookingUrl: null });
    expect(parseEventSessions({ Success: false })).toEqual([]);
  });
});

describe("combined Auckland sessions", () => {
  it("keeps one chain's sessions when the other chain fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("eventcinemas")) return json({}, 503);
      if (url.endsWith("/cinemaapi/api/movies")) return json(hoytsFilms);
      return json(url.endsWith("/1002") ? [
        hoytsSession({ id: 9, utcDate: "2026-09-28T08:00:00+00:00" }),
        hoytsSession({ id: 8, utcDate: "2026-09-28T06:30:00+00:00" }),
        hoytsSession({ id: 7, utcDate: "2026-09-27T23:00:00+00:00" }),
      ] : []);
    });
    const result = await fetchAucklandSessions({ date: "today", now: NOW, fetchImpl });

    expect(result.unavailableChains).toEqual(["EVENT Cinemas"]);
    expect(result.screenings.map((session) => session.id)).toEqual(["hoyts-1002-8", "hoyts-1002-9"]);
  });

  it("reports the source as unavailable only when every chain fails", async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    await expect(fetchAucklandSessions({ date: "today", now: NOW, fetchImpl })).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });
});
