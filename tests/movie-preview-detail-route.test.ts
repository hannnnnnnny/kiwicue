import { describe, expect, it, vi } from "vitest";
import { GET, handleMoviePreviewDetailRequest } from "../app/api/movie-previews/[movieId]/route";
import type { MoviePreviewDetail } from "../lib/movie-previews";
import { TmdbClientError } from "../lib/tmdb";

const movie: MoviePreviewDetail = {
  id: 550,
  title: "Fight Club",
  originalTitle: null,
  overview: "An insomniac meets a soap maker.",
  posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
  releaseDate: "1999-10-15",
  rating: 8.4,
  ratingCount: 31000,
  runtimeMinutes: 139,
  genres: ["Drama"],
  certification: "R16",
  trailerKey: "Abc_123-x",
  tmdbUrl: "https://www.themoviedb.org/movie/550",
};

describe("GET /api/movie-previews/[movieId]", () => {
  it("returns one localized normalized movie", async () => {
    const loadMovie = vi.fn().mockResolvedValue(movie);
    const response = await handleMoviePreviewDetailRequest("550", "zh", loadMovie);

    expect(loadMovie).toHaveBeenCalledWith({ movieId: 550, language: "zh" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=900");
    expect(await response.json()).toEqual({ movie });
  });

  it.each(["0", "-1", "1.5", "abc", "9007199254740992"])(
    "rejects invalid movie ID %s",
    async (movieId) => {
      const loadMovie = vi.fn();
      const response = await handleMoviePreviewDetailRequest(movieId, "en", loadMovie);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "INVALID_MOVIE_ID", message: "Invalid movie ID." },
      });
      expect(loadMovie).not.toHaveBeenCalled();
    },
  );

  it("rejects an unsupported language", async () => {
    const loadMovie = vi.fn();
    const response = await handleMoviePreviewDetailRequest("550", "fr", loadMovie);
    expect(response.status).toBe(400);
    expect(loadMovie).not.toHaveBeenCalled();
  });

  it("rejects duplicate language parameters before loading a movie", async () => {
    const response = await GET(
      new Request("http://localhost/api/movie-previews/550?language=en&language=zh"),
      { params: Promise.resolve({ movieId: "550" }) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_LANGUAGE", message: "Invalid language." },
    });
  });

  it.each([
    ["UPSTREAM_NOT_FOUND", 404, "Movie not found."],
    ["CONFIG_REQUIRED", 503, "Movie previews are temporarily unavailable."],
    ["UPSTREAM_BUSY", 503, "Movie previews are temporarily unavailable."],
    ["UPSTREAM_ERROR", 502, "Movie previews are temporarily unavailable."],
  ] as const)("returns a safe %s response", async (code, status, message) => {
    const loadMovie = vi.fn().mockRejectedValue(new TmdbClientError(code, status));
    const response = await handleMoviePreviewDetailRequest("550", "en", loadMovie);
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body).toEqual({ error: { code, message } });
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
