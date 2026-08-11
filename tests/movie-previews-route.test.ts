import { describe, expect, it, vi } from "vitest";
import { handleMoviePreviewsRequest } from "../app/api/movie-previews/route";
import type { MoviePreviewPage } from "../lib/movie-previews";
import { TmdbClientError } from "../lib/tmdb";

const page: MoviePreviewPage = {
  movies: [{
    id: 550,
    title: "Fight Club",
    originalTitle: null,
    overview: "An insomniac meets a soap maker.",
    posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
    releaseDate: "1999-10-15",
    rating: 8.4,
    ratingCount: 31000,
  }],
  page: { number: 1, totalPages: 2, totalResults: 21 },
};

describe("GET /api/movie-previews", () => {
  it("forwards normalized bilingual search input", async () => {
    const loadMovies = vi.fn().mockResolvedValue(page);
    const response = await handleMoviePreviewsRequest(
      new Request("http://localhost/api/movie-previews?language=zh&q=%20%E5%8D%83%E4%B8%8E%20%20%E5%8D%83%E5%AF%BB%20&page=2"),
      loadMovies,
    );

    expect(loadMovies).toHaveBeenCalledWith({ language: "zh", query: "千与 千寻", page: 2 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=900");
    expect(await response.json()).toEqual(page);
  });

  it("uses safe defaults for an absent query and invalid page", async () => {
    const loadMovies = vi.fn().mockResolvedValue(page);
    await handleMoviePreviewsRequest(
      new Request("http://localhost/api/movie-previews?page=999"),
      loadMovies,
    );
    expect(loadMovies).toHaveBeenCalledWith({ language: "en", query: null, page: 1 });
  });

  it.each([
    "language=fr",
    "language=en&language=zh",
    "q=one&q=two",
    `q=${"x".repeat(101)}`,
    "page=1&page=2",
  ])("rejects unsafe or duplicate public input: %s", async (query) => {
    const loadMovies = vi.fn();
    const response = await handleMoviePreviewsRequest(
      new Request(`http://localhost/api/movie-previews?${query}`),
      loadMovies,
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(loadMovies).not.toHaveBeenCalled();
  });

  it.each([
    ["CONFIG_REQUIRED", 503],
    ["UPSTREAM_AUTH", 502],
    ["UPSTREAM_BUSY", 503],
    ["UPSTREAM_TIMEOUT", 504],
    ["UPSTREAM_ERROR", 502],
  ] as const)("returns a safe %s response", async (code, status) => {
    const loadMovies = vi.fn().mockRejectedValue(new TmdbClientError(code, status));
    const response = await handleMoviePreviewsRequest(
      new Request("http://localhost/api/movie-previews"),
      loadMovies,
    );
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: { code, message: "Movie previews are temporarily unavailable." } });
    expect(JSON.stringify(body)).not.toContain("token");
  });
});
