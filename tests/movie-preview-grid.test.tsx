import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoviePreviewGrid } from "../components/movie-preview-grid";
import type { MoviePreview } from "../lib/movie-previews";
import { readApplicationCss } from "./css-source";

const movie: MoviePreview = {
  id: 550,
  title: "Fight Club",
  originalTitle: null,
  overview: "An insomniac meets a soap maker.",
  posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
  releaseDate: "1999-10-15",
  rating: 8.4,
  ratingCount: 31000,
};

afterEach(cleanup);

describe("movie preview grid", () => {
  it("renders poster-led movie cards with one in-site preview action", () => {
    render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="empty" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Explore recent New Zealand releases" })).toBeVisible();
    expect(screen.queryByText("Now playing in New Zealand")).not.toBeInTheDocument();
    expect(screen.getByText("Auckland session not verified")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Fight Club" })).toBeVisible();
    expect(screen.getByText("15 Oct 1999")).toBeVisible();
    expect(screen.getByText("TMDB 8.4")).toBeVisible();
    expect(screen.getByText("An insomniac meets a soap maker.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Preview Fight Club" })).toHaveAttribute("href", "/movies/550");
    expect(screen.getByRole("img", { name: "Fight Club poster" })).toHaveAttribute("loading", "lazy");
  });

  it("reserves the verified label for a movie matched by the live feed", () => {
    render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="ready" verifiedMovieIds={new Set([movie.id])} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText("Verified Auckland session")).toBeVisible();
    expect(screen.queryByText("Auckland session not verified")).not.toBeInTheDocument();
  });

  it("does not treat an unavailable session source as proof that a film is showing", () => {
    render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="unavailable" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText("Session check unavailable")).toBeVisible();
    expect(screen.queryByText("Verified Auckland session")).not.toBeInTheDocument();
  });

  it("labels previews as metadata-only when Auckland is outside provider coverage", () => {
    render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="not-covered" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText("Preview only · no Auckland live-data coverage")).toBeVisible();
    expect(screen.queryByText("Verified Auckland session")).not.toBeInTheDocument();
  });

  it("promotes the first film as the editorial feature", () => {
    const secondMovie = { ...movie, id: 551, title: "Second Film" };
    const view = render(<MoviePreviewGrid movies={[movie, secondMovie]} state="ready" sessionState="empty" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);

    expect(view.container.querySelectorAll('.movie-preview-card[data-layout="feature"]')).toHaveLength(1);
    expect(view.container.querySelectorAll('.movie-preview-card[data-layout="standard"]')).toHaveLength(1);
  });

  it("keeps the card usable when a poster fails", () => {
    const view = render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="empty" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    fireEvent.error(screen.getByRole("img", { name: "Fight Club poster" }));
    expect(view.container.querySelector("img[alt='Fight Club poster']")).not.toBeInTheDocument();
    expect(screen.getByText("Poster unavailable")).toBeVisible();
  });

  it("uses card-shaped skeletons while loading", () => {
    const view = render(<MoviePreviewGrid movies={[]} state="loading" sessionState="loading" verifiedMovieIds={new Set()} language="en" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole("status", { name: "Loading movie previews" })).toBeVisible();
    expect(view.container.querySelectorAll(".movie-preview-skeleton")).toHaveLength(4);
  });

  it("uses a single-column editorial flow without cramped split cards on phones", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*?\.movie-preview-grid,[\s\S]*?grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*?\.movie-preview-card\[data-layout="feature"\][^}]*grid-column:\s*auto/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*?\.movie-preview-card\[data-layout="feature"\]\s*>\s*a\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*?\.movie-preview-card\s*>\s*a\s*\{[^}]*grid-template-columns:\s*1fr/s);
  });

  it("offers a reset for an empty search", () => {
    const onReset = vi.fn();
    render(<MoviePreviewGrid movies={[]} state="empty" sessionState="empty" verifiedMovieIds={new Set()} language="en" query="Unknown film" onRetry={vi.fn()} onReset={onReset} />);
    expect(screen.getByRole("heading", { name: "No movie previews matched “Unknown film”" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear movie search" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("offers a retry without hiding the rest of the movie page", () => {
    const onRetry = vi.fn();
    render(<MoviePreviewGrid movies={[]} state="unavailable" sessionState="unavailable" verifiedMovieIds={new Set()} language="en" query={null} onRetry={onRetry} onReset={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Movie preview verification is temporarily unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry movie previews" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("provides Chinese labels and required TMDB attribution", () => {
    render(<MoviePreviewGrid movies={[movie]} state="ready" sessionState="empty" verifiedMovieIds={new Set()} language="zh" query={null} onRetry={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "探索新西兰近期电影" })).toBeVisible();
    expect(screen.getByText("奥克兰场次尚未核实")).toBeVisible();
    expect(screen.getByRole("link", { name: "查看 Fight Club 预览" })).toHaveAttribute("href", "/movies/550");
    expect(screen.getByText("本产品使用 TMDB API，但未经 TMDB 认可或认证。")).toBeVisible();
    expect(screen.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.")).toBeVisible();
  });
});
