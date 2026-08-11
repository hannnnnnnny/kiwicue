import { describe, expect, it, vi } from "vitest";
import { handleMoviesRequest } from "../app/api/movies/route";
import { OpenCinemaClientError } from "../lib/open-cinema";

describe("GET /api/movies", () => {
  it("forwards one normalized query and date without exposing credentials", async () => {
    const loadScreenings = vi.fn().mockResolvedValue([{ id: "screening-1" }]);
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies?q=%20Whina%20%20Film%20&date=weekend"),
      loadScreenings,
      new Date("2026-08-12T02:00:00.000Z"),
    );

    expect(loadScreenings).toHaveBeenCalledWith({ query: "Whina Film", date: "weekend" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      screenings: [{ id: "screening-1" }],
      source: "open-cinema",
      sourceState: "ready",
    });
  });

  it("labels a successful empty feed", async () => {
    const response = await handleMoviesRequest(
      new Request("http://localhost/api/movies"),
      vi.fn().mockResolvedValue([]),
      new Date("2026-08-12T02:00:00.000Z"),
    );
    expect(await response.json()).toEqual({ screenings: [], source: "open-cinema", sourceState: "empty" });
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
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      screenings: [],
      source: "open-cinema",
      sourceState: "unavailable",
    });
  });
});
