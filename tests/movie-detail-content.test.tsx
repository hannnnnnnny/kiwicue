import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MovieDetailContent,
  MovieDetailRequestError,
} from "../components/movie-detail-content";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import type { MoviePreviewDetail, MoviePreviewDetailResponse } from "../lib/movie-previews";

const movie: MoviePreviewDetail = {
  id: 550,
  title: "Fight Club",
  originalTitle: null,
  overview: "An insomniac meets a soap maker and forms an underground club.",
  posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
  releaseDate: "1999-10-15",
  rating: 8.4,
  ratingCount: 31000,
  runtimeMinutes: 139,
  genres: ["Drama", "Thriller"],
  certification: "R16",
  trailerKey: "Abc_123-x",
  tmdbUrl: "https://www.themoviedb.org/movie/550",
};

function renderDetail(requestMovieDetail: (movieId: string, language: "en" | "zh") => Promise<MoviePreviewDetailResponse>) {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <MovieDetailContent movieId="550" requestMovieDetail={requestMovieDetail} />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("movie detail experience", () => {
  it("shows the full preview, safe trailer, attribution, and official cinema choices", async () => {
    const requestMovieDetail = vi.fn().mockResolvedValue({ movie, sessionStatus: "verified" });
    renderDetail(requestMovieDetail);

    expect(screen.getByRole("status")).toHaveTextContent("Loading movie preview");
    expect(await screen.findByRole("heading", { level: 1, name: "Fight Club" })).toBeVisible();
    expect(screen.getByText("A current Auckland session matched this movie when the page loaded. Confirm final availability on the cinema's official site.")).toBeVisible();
    expect(requestMovieDetail).toHaveBeenCalledWith("550", "en");
    expect(screen.getByText("15 Oct 1999")).toBeVisible();
    expect(screen.getByText("2 hr 19 min")).toBeVisible();
    expect(screen.getByText("R16")).toBeVisible();
    expect(screen.getByText("Drama")).toBeVisible();
    expect(screen.getByText(movie.overview!)).toBeVisible();
    expect(screen.getByRole("img", { name: "Fight Club poster" })).toHaveAttribute("loading", "eager");
    expect(screen.getByTitle("Fight Club official trailer")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/Abc_123-x",
    );
    expect(screen.getByTitle("Fight Club official trailer")).not.toHaveAttribute("src", expect.stringContaining("autoplay"));
    expect(screen.getByRole("link", { name: "Open trailer on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=Abc_123-x",
    );
    expect(screen.getByRole("link", { name: "Back to movies" })).toHaveAttribute("href", "/movies");
    expect(screen.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Check Auckland cinema sessions" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toHaveAttribute("target", "_blank");
  });

  it("labels a release preview honestly when its Auckland session is not verified", async () => {
    renderDetail(vi.fn().mockResolvedValue({ movie, sessionStatus: "unverified" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Fight Club" })).toBeVisible();
    expect(screen.getByText("Release preview · Auckland session not verified")).toBeVisible();
    expect(screen.getByText("Use the official cinema links below to confirm whether this film is currently showing.")).toBeVisible();
  });

  it("states that coverage is missing instead of claiming the movie is not showing", async () => {
    renderDetail(vi.fn().mockResolvedValue({ movie, sessionStatus: "not-covered" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Fight Club" })).toBeVisible();
    expect(screen.getByText("Release preview · Auckland live-data coverage unavailable")).toBeVisible();
    expect(screen.getByText(/does not mean the film is not showing/i)).toBeVisible();
  });

  it("shows honest fallbacks when optional metadata is absent", async () => {
    renderDetail(vi.fn().mockResolvedValue({
      movie: {
        ...movie,
        overview: null,
        posterUrl: null,
        releaseDate: null,
        runtimeMinutes: null,
        certification: null,
        rating: null,
        genres: [],
        trailerKey: null,
      },
      sessionStatus: "unverified",
    }));

    await screen.findByRole("heading", { level: 1, name: "Fight Club" });
    expect(screen.getByText("No synopsis is available from the source yet.")).toBeVisible();
    expect(screen.getByText("Poster unavailable")).toBeVisible();
    expect(screen.getByRole("heading", { name: "No official trailer is currently available" })).toBeVisible();
    expect(screen.queryByTitle(/trailer/i)).not.toBeInTheDocument();
  });

  it("refuses to interpolate a malformed trailer key", async () => {
    renderDetail(vi.fn().mockResolvedValue({
      movie: { ...movie, trailerKey: "bad<script>" },
      sessionStatus: "unverified",
    }));
    await screen.findByRole("heading", { level: 1, name: "Fight Club" });
    expect(screen.queryByTitle(/official trailer/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No official trailer is currently available" })).toBeVisible();
  });

  it("shows a dedicated not-found state", async () => {
    renderDetail(vi.fn().mockRejectedValue(new MovieDetailRequestError(404)));
    expect(await screen.findByRole("heading", { name: "Movie preview not found" })).toBeVisible();
    expect(screen.getByText("This movie is not available from the preview source.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse movie previews" })).toHaveAttribute("href", "/movies");
  });

  it("retries a temporary failure", async () => {
    const requestMovieDetail = vi.fn()
      .mockRejectedValueOnce(new MovieDetailRequestError(503))
      .mockResolvedValueOnce({ movie, sessionStatus: "verified" });
    renderDetail(requestMovieDetail);
    expect(await screen.findByRole("heading", { name: "Movie preview is temporarily unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry movie preview" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Fight Club" })).toBeVisible();
    expect(requestMovieDetail).toHaveBeenCalledTimes(2);
  });

  it("refetches localized metadata when switching to Chinese", async () => {
    const requestMovieDetail = vi.fn().mockResolvedValue({ movie, sessionStatus: "verified" });
    renderDetail(requestMovieDetail);
    await screen.findByRole("heading", { level: 1, name: "Fight Club" });
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
    expect(await screen.findByTitle("Fight Club 官方预告片")).toBeVisible();
    expect(screen.getByRole("heading", { name: "查看奥克兰影院场次" })).toBeVisible();
    expect(requestMovieDetail).toHaveBeenLastCalledWith("550", "zh");
  });
});
