import { describe, expect, it } from "vitest";
import {
  parseMovieId,
  parseMoviePreviewLanguage,
  parseMoviePreviewPage,
  parseMoviePreviewQuery,
} from "../lib/movie-previews";

describe("movie preview public inputs", () => {
  it("normalizes a bounded movie query", () => {
    expect(parseMoviePreviewQuery("  Spider   Man  ")).toBe("Spider Man");
    expect(parseMoviePreviewQuery("Cafe\u0301")).toBe("Café");
    expect(parseMoviePreviewQuery("   ")).toBeNull();
    expect(parseMoviePreviewQuery("x".repeat(101))).toBeNull();
    expect(parseMoviePreviewQuery(["Avatar"])).toBeNull();
  });

  it("accepts only bounded pages", () => {
    expect(parseMoviePreviewPage("1")).toBe(1);
    expect(parseMoviePreviewPage("20")).toBe(20);
    expect(parseMoviePreviewPage("0")).toBe(1);
    expect(parseMoviePreviewPage("21")).toBe(1);
    expect(parseMoviePreviewPage("1.5")).toBe(1);
  });

  it("accepts only safe positive movie IDs", () => {
    expect(parseMovieId("123456")).toBe(123456);
    expect(parseMovieId("0")).toBeNull();
    expect(parseMovieId("-1")).toBeNull();
    expect(parseMovieId("1.5")).toBeNull();
    expect(parseMovieId("9007199254740992")).toBeNull();
    expect(parseMovieId(["123"])).toBeNull();
  });

  it("uses English unless Chinese is explicitly requested", () => {
    expect(parseMoviePreviewLanguage("zh")).toBe("zh");
    expect(parseMoviePreviewLanguage("en")).toBe("en");
    expect(parseMoviePreviewLanguage("fr")).toBe("en");
  });
});
