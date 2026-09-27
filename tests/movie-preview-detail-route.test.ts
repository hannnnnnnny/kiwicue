import { describe, expect, it, vi } from "vitest";
import { GET, handleMoviePreviewDetailRequest } from "../app/api/movie-previews/[movieId]/route";
import type { MoviePreviewDetail } from "../lib/movie-previews";
import { CinemaSourceError } from "../lib/cinemas/source-fetch";
import type { KiwiCueScreening } from "../lib/movies";
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
  const now = new Date("2026-08-12T02:00:00.000Z");
  const verifiedScreening: KiwiCueScreening = {
    id: "hoyts-1002-1",
    filmId: "hoyts-HO1",
    filmTitle: "Fight Club",
    filmRating: "R16",
    runtimeMinutes: 139,
    cinemaId: "hoyts-1002",
    cinemaName: "HOYTS Sylvia Park",
    chain: "HOYTS",
    startTime: "2026-08-15T08:00:00.000Z",
    screenType: "LUX",
    formats: [],
    soldOut: false,
    discounted: false,
    bookingUrl: "https://www.hoyts.co.nz/orders/tickets?cinemaId=1002&sessionId=1",
    price: null,
  };
  const priced = { ...verifiedScreening, price: { minCents: 2800, maxCents: 4300, bookingFeeCents: 345 } };
  const sessions = (screenings: KiwiCueScreening[], unavailableChains: string[] = []) =>
    vi.fn().mockResolvedValue({ screenings, unavailableChains });
  const attachPrices = vi.fn(async (matches: KiwiCueScreening[]) => matches.map((match) => ({ ...match, price: priced.price })));

  it("returns one localized normalized movie", async () => {
    const loadMovie = vi.fn().mockResolvedValue(movie);
    const loadSessions = sessions([verifiedScreening, { ...verifiedScreening, id: "other", filmTitle: "Other Film" }], ["EVENT Cinemas"]);
    const response = await handleMoviePreviewDetailRequest("550", "zh", loadMovie, loadSessions, now, attachPrices);

    expect(loadMovie).toHaveBeenCalledWith({ movieId: 550, language: "zh" });
    expect(attachPrices).toHaveBeenCalledWith([verifiedScreening]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      movie,
      screenings: [priced],
      sessionStatus: "verified",
      unavailableChains: ["EVENT Cinemas"],
      checkedAt: expect.any(String),
    });
  });

  it("returns preview metadata with an honest unverified status when no Auckland session matches", async () => {
    const loadMovie = vi.fn().mockResolvedValue(movie);
    const noPrices = vi.fn();
    const response = await handleMoviePreviewDetailRequest("550", "en", loadMovie, sessions([]), now, noPrices);

    expect(response.status).toBe(200);
    expect(noPrices).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      movie,
      screenings: [],
      sessionStatus: "unverified",
      unavailableChains: [],
      checkedAt: expect.any(String),
    });
  });

  it("uses the stable English title to verify a localized Chinese detail", async () => {
    const localizedMovie = {
      ...movie,
      title: "搏击俱乐部",
      originalTitle: "搏击俱乐部",
    };
    const loadMovie = vi.fn().mockImplementation(({ language }: { language: "en" | "zh" }) =>
      Promise.resolve(language === "zh" ? localizedMovie : movie));
    const response = await handleMoviePreviewDetailRequest("550", "zh", loadMovie, sessions([verifiedScreening]), now, attachPrices);

    expect(response.status).toBe(200);
    expect(loadMovie).toHaveBeenCalledWith({ movieId: 550, language: "zh" });
    expect(loadMovie).toHaveBeenCalledWith({ movieId: 550, language: "en" });
    expect(await response.json()).toEqual({
      movie: localizedMovie,
      screenings: [priced],
      sessionStatus: "verified",
      unavailableChains: [],
      checkedAt: expect.any(String),
    });
  });

  it("keeps the preview available but reports when live session verification is unavailable", async () => {
    const response = await handleMoviePreviewDetailRequest(
      "550",
      "en",
      vi.fn().mockResolvedValue(movie),
      vi.fn().mockRejectedValue(new CinemaSourceError("UPSTREAM_BUSY")),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      movie,
      screenings: [],
      sessionStatus: "unavailable",
      unavailableChains: [],
      checkedAt: expect.any(String),
    });
  });

  it("drops a same-title session whose runtime does not match", async () => {
    const response = await handleMoviePreviewDetailRequest(
      "550", "en", vi.fn().mockResolvedValue(movie),
      sessions([verifiedScreening, { ...verifiedScreening, id: "remake", runtimeMinutes: 170 }]), now, attachPrices,
    );
    const body = await response.json();
    expect(body.screenings.map((session: { id: string }) => session.id)).toEqual(["hoyts-1002-1"]);
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
