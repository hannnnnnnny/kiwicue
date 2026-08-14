import { describe, expect, it } from "vitest";
import type { MoviePreview } from "../lib/movie-previews";
import type { KiwiCueScreening } from "../lib/movies";
import { filterVerifiedMoviePreviews, movieHasVerifiedSession } from "../lib/verified-movie-sessions";

const movie: MoviePreview = {
  id: 1545621,
  title: "Detective Conan: Fallen Angel of the Highway",
  originalTitle: "名探偵コナン ハイウェイの堕天使",
  overview: null,
  posterUrl: null,
  releaseDate: "2026-07-23",
  rating: 7.6,
  ratingCount: 15,
};

function screening(filmTitle: string): KiwiCueScreening {
  return {
    id: "screening-1",
    filmId: "film-1",
    filmTitle,
    filmRating: null,
    runtimeMinutes: null,
    cinemaId: "cinema-1",
    cinemaName: "Academy Cinemas",
    startTime: "2026-08-15T08:00:00.000Z",
    formats: [],
    soldOut: false,
    distanceKilometres: null,
    bookingUrl: null,
  };
}

describe("verified movie sessions", () => {
  it("matches only a normalized complete movie title", () => {
    expect(movieHasVerifiedSession(movie, [screening("Detective Conan — Fallen Angel of the Highway")])).toBe(true);
    expect(movieHasVerifiedSession(movie, [screening("Detective Conan")])).toBe(false);
  });

  it("removes a recent TMDB release when no current Auckland session exists", () => {
    expect(filterVerifiedMoviePreviews([movie], [])).toEqual([]);
  });
});
