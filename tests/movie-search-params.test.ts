import { describe, expect, it } from "vitest";
import { parseMovieDateFilter, parseMovieQuery } from "../lib/movie-search-params";

describe("movie search parameters", () => {
  it("normalizes one Unicode query and repeated whitespace", () => {
    expect(parseMovieQuery("  Amélie　 Poulain  ")).toBe("Amélie Poulain");
    expect(parseMovieQuery("e\u0301")).toBe("é");
  });

  it.each([null, undefined, "", "   "])("treats %j as no query", (value) => {
    expect(parseMovieQuery(value)).toBeNull();
  });

  it("rejects arrays, control characters, and overlong values", () => {
    expect(parseMovieQuery(["one", "two"])).toBeNull();
    expect(parseMovieQuery("one\ntwo")).toBeNull();
    expect(parseMovieQuery("x".repeat(101))).toBeNull();
  });

  it("accepts supported dates and defaults safely to today", () => {
    expect(parseMovieDateFilter("tomorrow")).toBe("tomorrow");
    expect(parseMovieDateFilter("weekend")).toBe("weekend");
    expect(parseMovieDateFilter("all")).toBe("all");
    expect(parseMovieDateFilter(null)).toBe("today");
    expect(parseMovieDateFilter("year")).toBe("today");
  });
});
