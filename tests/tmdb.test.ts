import { describe, expect, it, vi } from "vitest";
import {
  buildTmdbMovieDetailUrl,
  buildTmdbMovieListUrl,
  fetchTmdbMovieDetail,
  fetchTmdbMoviePreviews,
  normalizeTmdbMovie,
  normalizeTmdbMovieDetail,
  selectTmdbTrailer,
} from "../lib/tmdb";

const listMovie = {
  id: 550,
  title: "Fight Club",
  original_title: "Fight Club",
  overview: "An insomniac meets a soap maker.",
  poster_path: "/fight-club.jpg",
  release_date: "1999-10-15",
  vote_average: 8.4,
  vote_count: 31000,
};

describe("TMDB movie adapter", () => {
  it("builds New Zealand now-playing and localized search URLs", () => {
    const nowPlaying = buildTmdbMovieListUrl({ language: "en", query: null, page: 2 });
    expect(nowPlaying.origin).toBe("https://api.themoviedb.org");
    expect(nowPlaying.pathname).toBe("/3/movie/now_playing");
    expect(nowPlaying.searchParams.get("region")).toBe("NZ");
    expect(nowPlaying.searchParams.get("language")).toBe("en-NZ");
    expect(nowPlaying.searchParams.get("page")).toBe("2");
    expect(nowPlaying.searchParams.get("include_adult")).toBeNull();

    const search = buildTmdbMovieListUrl({ language: "zh", query: "千与千寻", page: 1 });
    expect(search.pathname).toBe("/3/search/movie");
    expect(search.searchParams.get("query")).toBe("千与千寻");
    expect(search.searchParams.get("language")).toBe("zh-CN");
    expect(search.searchParams.get("region")).toBe("NZ");
    expect(search.searchParams.get("include_adult")).toBe("false");
  });

  it("builds a localized detail request with videos and release dates", () => {
    const url = buildTmdbMovieDetailUrl({ movieId: 550, language: "zh" });
    expect(url.pathname).toBe("/3/movie/550");
    expect(url.searchParams.get("language")).toBe("zh-CN");
    expect(url.searchParams.get("append_to_response")).toBe("videos,release_dates");
  });

  it("normalizes only safe list metadata", () => {
    expect(normalizeTmdbMovie(listMovie)).toEqual({
      id: 550,
      title: "Fight Club",
      originalTitle: null,
      overview: "An insomniac meets a soap maker.",
      posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
      releaseDate: "1999-10-15",
      rating: 8.4,
      ratingCount: 31000,
    });
  });

  it("drops malformed media and optional values without inventing data", () => {
    expect(normalizeTmdbMovie({
      ...listMovie,
      original_title: "Original title",
      poster_path: "https://evil.example/poster.jpg",
      release_date: "2026-02-30",
      overview: "   ",
      vote_average: 12,
      vote_count: -4,
    })).toEqual({
      id: 550,
      title: "Fight Club",
      originalTitle: "Original title",
      overview: null,
      posterUrl: null,
      releaseDate: null,
      rating: null,
      ratingCount: 0,
    });
    expect(normalizeTmdbMovie({ ...listMovie, id: -1 })).toBeNull();
    expect(normalizeTmdbMovie({ ...listMovie, title: " " })).toBeNull();
  });

  it("prefers an official localized trailer, then official English", () => {
    const videos = {
      results: [
        { key: "generic_123", site: "YouTube", type: "Trailer", official: false, iso_639_1: "zh" },
        { key: "english_123", site: "YouTube", type: "Trailer", official: true, iso_639_1: "en" },
        { key: "chinese_123", site: "YouTube", type: "Trailer", official: true, iso_639_1: "zh" },
        { key: "bad<script>", site: "YouTube", type: "Trailer", official: true, iso_639_1: "zh" },
      ],
    };
    expect(selectTmdbTrailer(videos, "zh")).toBe("chinese_123");
    expect(selectTmdbTrailer(videos, "en")).toBe("english_123");
    expect(selectTmdbTrailer({ results: [{ ...videos.results[0], site: "Vimeo" }] }, "zh")).toBeNull();
  });

  it("normalizes details, New Zealand certification, and a safe trailer", () => {
    const detail = normalizeTmdbMovieDetail({
      ...listMovie,
      runtime: 139,
      genres: [{ id: 18, name: "Drama" }, { id: 53, name: "Thriller" }],
      videos: { results: [{ key: "Abc_123-x", site: "YouTube", type: "Trailer", official: true, iso_639_1: "en" }] },
      release_dates: {
        results: [{ iso_3166_1: "NZ", release_dates: [{ certification: "R16" }] }],
      },
    }, "en");
    expect(detail).toMatchObject({
      id: 550,
      runtimeMinutes: 139,
      genres: ["Drama", "Thriller"],
      certification: "R16",
      trailerKey: "Abc_123-x",
      tmdbUrl: "https://www.themoviedb.org/movie/550",
    });
  });

  it("fetches a normalized page with a private bearer token and cache window", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      page: 1,
      total_pages: 2,
      total_results: 1,
      results: [listMovie],
    }), { status: 200 }));

    const result = await fetchTmdbMoviePreviews({
      token: "private-token",
      language: "en",
      query: null,
      page: 1,
      fetchImpl,
    });

    expect(result.movies).toHaveLength(1);
    const [, init] = fetchImpl.mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer private-token");
    expect(init).toMatchObject({ next: { revalidate: 900 } });
  });

  it("maps missing configuration and upstream failures without leaking bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(fetchTmdbMoviePreviews({ token: "", language: "en", query: null, page: 1, fetchImpl }))
      .rejects.toMatchObject({ code: "CONFIG_REQUIRED", status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();

    const privateBodyFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("private upstream details", { status: 429 }),
    );
    const request = fetchTmdbMoviePreviews({
      token: "token",
      language: "en",
      query: null,
      page: 1,
      fetchImpl: privateBodyFetch,
    });
    await expect(request).rejects.toMatchObject({ code: "UPSTREAM_BUSY", status: 503 });
    await expect(request).rejects.not.toThrow("private upstream details");
  });

  it("fetches one normalized movie detail", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      ...listMovie,
      runtime: 139,
      genres: [],
      videos: { results: [] },
      release_dates: { results: [] },
    }), { status: 200 }));

    const result = await fetchTmdbMovieDetail({
      token: "token",
      movieId: 550,
      language: "en",
      fetchImpl,
    });
    expect(result).toMatchObject({ id: 550, trailerKey: null });
  });
});
