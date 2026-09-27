import { describe, expect, it } from "vitest";
import type { MoviePreviewDetail } from "../lib/movie-previews";
import type { KiwiCueScreening } from "../lib/movies";
import { filterShowingMoviePreviews, findMovieSessionMatches } from "../lib/verified-movie-sessions";

const movie: MoviePreviewDetail = {
  id: 1545621,
  title: "Detective Conan: Fallen Angel of the Highway",
  originalTitle: "名探偵コナン ハイウェイの堕天使",
  overview: null,
  posterUrl: null,
  releaseDate: "2026-07-23",
  rating: 7.6,
  ratingCount: 15,
  runtimeMinutes: 109,
  genres: [],
  certification: null,
  trailerKey: null,
  tmdbUrl: "https://www.themoviedb.org/movie/1545621",
};

function screening(filmTitle: string, runtimeMinutes: number | null = 109): KiwiCueScreening {
  return {
    id: "screening-1",
    filmId: "film-1",
    filmTitle,
    filmRating: null,
    runtimeMinutes,
    cinemaId: "hoyts-1002",
    cinemaName: "HOYTS Sylvia Park",
    chain: "HOYTS",
    startTime: "2026-08-15T08:00:00.000Z",
    screenType: "Standard",
    formats: [],
    soldOut: false,
    discounted: false,
    bookingUrl: null,
    price: null,
  };
}

describe("verified movie sessions", () => {
  it("matches a normalized complete title when both known runtimes agree", () => {
    expect(findMovieSessionMatches(movie, [screening("Detective Conan — Fallen Angel of the Highway")])).toHaveLength(1);
    expect(findMovieSessionMatches(movie, [screening("Detective Conan")])).toEqual([]);
  });

  it("rejects a title match with contradictory known runtimes", () => {
    expect(findMovieSessionMatches(movie, [screening(movie.title, 142)])).toEqual([]);
  });

  it("keeps an exact title match when the provider omits runtime", () => {
    expect(findMovieSessionMatches(movie, [screening(movie.title, null)])).toHaveLength(1);
  });

  it("accepts a bilingual title match when an English title is supplied", () => {
    const chineseMovie = { ...movie, title: "名侦探柯南：高速公路的堕天使", originalTitle: "名探偵コナン ハイウェイの堕天使" };
    const englishMovie = { ...movie, originalTitle: null };
    expect(findMovieSessionMatches(chineseMovie, [screening(movie.title)], englishMovie)).toHaveLength(1);
  });

  it("marks list previews as showing on a complete title match", () => {
    const preview = { id: movie.id, title: movie.title, originalTitle: null, overview: null, posterUrl: null, releaseDate: null, rating: null, ratingCount: 0 };
    expect(filterShowingMoviePreviews([preview], [{ title: "Detective Conan: Fallen Angel of the Highway" }])).toEqual([preview]);
    expect(filterShowingMoviePreviews([preview], [{ title: "Detective Conan" }])).toEqual([]);
  });
});
