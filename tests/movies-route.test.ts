import { describe, expect, it, vi } from "vitest";
import { handleMoviesRequest } from "../app/api/movies/route";
import { OpenCinemaClientError } from "../lib/open-cinema";

describe("GET /api/movies", () => {
  it("keeps user search terms inside KiwiCue and returns coverage evidence", async () => {
    const loadScreenings = vi.fn().mockResolvedValue([{
      id: "screening-1",
      filmTitle: "Whina Film",
      cinemaName: "Academy Cinemas",
    }]);
    const loadCoverage = vi.fn().mockResolvedValue("covered");
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies?q=%20Whina%20%20Film%20&date=weekend"),
      loadScreenings,
      new Date("2026-08-12T02:00:00.000Z"),
      loadCoverage,
    );

    expect(loadScreenings).toHaveBeenCalledWith({ query: null, date: "weekend" });
    expect(loadCoverage).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      screenings: [{ id: "screening-1", filmTitle: "Whina Film", cinemaName: "Academy Cinemas" }],
      source: "open-cinema",
      sourceState: "ready",
      coverageState: "covered",
      checkedAt: "2026-08-12T02:00:00.000Z",
    });
  });

  it("labels a successful empty feed", async () => {
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies"),
      vi.fn().mockResolvedValue([]),
      new Date("2026-08-12T02:00:00.000Z"),
      vi.fn().mockResolvedValue("covered"),
    );
    expect(await response.json()).toEqual({
      screenings: [], source: "open-cinema", sourceState: "empty",
      coverageState: "covered", checkedAt: "2026-08-12T02:00:00.000Z",
    });
  });

  it("does not imply an empty schedule when the provider has no Auckland coverage", async () => {
    const loadScreenings = vi.fn();
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies"),
      loadScreenings,
      new Date("2026-08-12T02:00:00.000Z"),
      vi.fn().mockResolvedValue("not-covered"),
    );
    expect(loadScreenings).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      screenings: [], source: "open-cinema", sourceState: "not-covered",
      coverageState: "not-covered", checkedAt: "2026-08-12T02:00:00.000Z",
    });
  });

  it.each([
    "q=one&q=two",
    "date=today&date=tomorrow",
    "date=year",
    `q=${"x".repeat(101)}`,
    "q=one%0Atwo",
  ])("rejects invalid or duplicate public input: %s", async (query) => {
    const loadScreenings = vi.fn();
    const response = await handleMoviesRequest(
      new Request(`http://localhost/api/movies?${query}`),
      loadScreenings,
      new Date("2026-08-12T02:00:00.000Z"),
      vi.fn().mockResolvedValue("covered"),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(loadScreenings).not.toHaveBeenCalled();
  });

  it("degrades upstream failures to an available directory response", async () => {
    const loadScreenings = vi.fn().mockRejectedValue(new OpenCinemaClientError("UPSTREAM_BUSY"));
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies?date=today"),
      loadScreenings,
      new Date("2026-08-12T02:00:00.000Z"),
      vi.fn().mockResolvedValue("covered"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      screenings: [],
      source: "open-cinema",
      sourceState: "unavailable",
      coverageState: "unavailable",
      checkedAt: "2026-08-12T02:00:00.000Z",
    });
  });
});
