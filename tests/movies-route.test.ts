import { describe, expect, it, vi } from "vitest";
import { handleMoviesRequest } from "../app/api/movies/route";
import { CinemaSourceError } from "../lib/cinemas/source-fetch";
import type { KiwiCueScreening } from "../lib/movies";

const NOW = new Date("2026-08-12T02:00:00.000Z");

function screening(overrides: Partial<KiwiCueScreening>): KiwiCueScreening {
  return {
    id: "hoyts-1002-1", filmId: "hoyts-HO1", filmTitle: "Whina", filmRating: "M", runtimeMinutes: 112,
    cinemaId: "hoyts-1002", cinemaName: "HOYTS Sylvia Park", chain: "HOYTS", startTime: "2026-08-12T06:00:00.000Z",
    screenType: "Standard", formats: [], soldOut: false, discounted: false,
    bookingUrl: "https://www.hoyts.co.nz/orders/tickets?cinemaId=1002&sessionId=1", price: null,
    ...overrides,
  };
}

describe("GET /api/movies", () => {
  it("groups sessions into films and filters by film or cinema name", async () => {
    const loadSessions = vi.fn().mockResolvedValue({
      screenings: [
        screening({}),
        screening({ id: "event-9", cinemaId: "event-502", cinemaName: "EVENT Cinemas Queen Street", chain: "EVENT Cinemas", screenType: "Gold Class", startTime: "2026-08-12T08:00:00.000Z" }),
        screening({ id: "hoyts-1002-2", filmTitle: "Another Film" }),
      ],
      unavailableChains: [],
    });
    const response = await handleMoviesRequest(new Request("http://localhost/api/movies?q=%20Whina%20&date=weekend"), loadSessions, NOW);

    expect(loadSessions).toHaveBeenCalledWith({ date: "weekend" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      films: [{
        id: "whina", title: "Whina", rating: "M", runtimeMinutes: 112, cinemaCount: 2, sessionCount: 2,
        nextStartTime: "2026-08-12T06:00:00.000Z", nextCinemaName: "HOYTS Sylvia Park", screenTypes: ["Gold Class", "Standard"],
      }],
      sourceState: "ready",
      unavailableChains: [],
      checkedAt: NOW.toISOString(),
    });
  });

  it("labels an empty day and passes through a chain that could not be checked", async () => {
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies"),
      vi.fn().mockResolvedValue({ screenings: [], unavailableChains: ["EVENT Cinemas"] }),
      NOW,
    );
    expect(await response.json()).toEqual({
      films: [], sourceState: "empty", unavailableChains: ["EVENT Cinemas"], checkedAt: NOW.toISOString(),
    });
  });

  it.each([
    "q=one&q=two",
    "date=today&date=tomorrow",
    "date=year",
    `q=${"x".repeat(101)}`,
    "q=one%0Atwo",
  ])("rejects invalid or duplicate public input: %s", async (query) => {
    const loadSessions = vi.fn();
    const response = await handleMoviesRequest(new Request(`http://localhost/api/movies?${query}`), loadSessions, NOW);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(loadSessions).not.toHaveBeenCalled();
  });

  it("degrades to an unavailable state when every cinema chain fails", async () => {
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies?date=today"),
      vi.fn().mockRejectedValue(new CinemaSourceError("UPSTREAM_BUSY")),
      NOW,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      films: [], sourceState: "unavailable", unavailableChains: [], checkedAt: NOW.toISOString(),
    });
  });
});
