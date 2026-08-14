import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import { MoviesPageContent } from "../components/movies-page-content";

function renderPage() {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <MoviesPageContent initialQuery={null} initialDate="today" />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const payload = url.startsWith("/api/movie-previews")
      ? {
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
          page: { number: 1, totalPages: 1, totalResults: 1 },
        }
      : { screenings: [], source: "open-cinema", sourceState: "empty" };
    return Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("movies page", () => {
  it("puts search first and keeps the cinema directory useful when the feed is empty", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Find films and verified Auckland sessions" })).toBeVisible();
    expect(screen.getByRole("search", { name: "Find a movie or cinema" })).toBeVisible();
    const previews = await screen.findByRole("heading", { name: "Previews for current Auckland sessions" });
    expect(screen.queryByRole("link", { name: "Preview Fight Club" })).not.toBeInTheDocument();
    expect(screen.getByText("No verified movie previews available")).toBeVisible();
    const liveSessions = await screen.findByRole("heading", { name: "Live movie sessions" });
    expect(liveSessions.compareDocumentPosition(previews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("No open-feed sessions found")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Auckland cinema directory" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toHaveAttribute("href", "https://academycinemas.co.nz/");
  });

  it("shows preview metadata only when its title matches a verified Auckland session", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const payload = String(input).startsWith("/api/movie-previews")
        ? {
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
            page: { number: 1, totalPages: 1, totalResults: 1 },
          }
        : {
            screenings: [{
              id: "screening-1",
              filmId: "film-1",
              filmTitle: "Fight Club",
              filmRating: "R16",
              runtimeMinutes: 139,
              cinemaId: "cinema-1",
              cinemaName: "Academy Cinemas",
              startTime: "2026-08-15T08:00:00.000Z",
              formats: ["2D"],
              soldOut: false,
              distanceKilometres: 1.2,
              bookingUrl: "https://academycinemas.co.nz/film/fight-club",
            }],
            source: "open-cinema",
            sourceState: "ready",
          };
      return Promise.resolve(Response.json(payload));
    }));

    renderPage();

    expect(await screen.findByRole("link", { name: "Preview Fight Club" })).toHaveAttribute("href", "/movies/550");
    expect(screen.getByText("Verified Auckland session")).toBeVisible();
  });

  it("keeps a verified preview when Chinese localization changes every visible title", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/movies")) {
        return Promise.resolve(Response.json({
          screenings: [{
            id: "screening-conan",
            filmId: "film-conan",
            filmTitle: "Detective Conan: Fallen Angel of the Highway",
            filmRating: null,
            runtimeMinutes: 109,
            cinemaId: "cinema-1",
            cinemaName: "Academy Cinemas",
            startTime: "2026-08-15T08:00:00.000Z",
            formats: ["2D"],
            soldOut: false,
            distanceKilometres: 1.2,
            bookingUrl: "https://academycinemas.co.nz/film/conan",
          }],
          source: "open-cinema",
          sourceState: "ready",
        }));
      }
      const chinese = url.includes("language=zh");
      return Promise.resolve(Response.json({
        movies: [{
          id: 1545621,
          title: chinese ? "名侦探柯南：高速公路的堕天使" : "Detective Conan: Fallen Angel of the Highway",
          originalTitle: "名探偵コナン ハイウェイの堕天使",
          overview: "A mystery on the highway.",
          posterUrl: null,
          releaseDate: "2026-07-23",
          rating: 7.6,
          ratingCount: 15,
        }],
        page: { number: 1, totalPages: 1, totalResults: 1 },
      }));
    }));

    renderPage();
    expect(await screen.findByRole("link", { name: "Preview Detective Conan: Fallen Angel of the Highway" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(await screen.findByRole("link", { name: "查看 名侦探柯南：高速公路的堕天使 预览" })).toBeVisible();
  });

  it("submits a normalized search, changes date, and can clear the query", async () => {
    renderPage();
    await screen.findByText("No open-feed sessions found");
    fireEvent.change(screen.getByLabelText("Movie, cinema, or suburb"), { target: { value: "  Whina  " } });
    fireEvent.submit(screen.getByRole("search", { name: "Find a movie or cinema" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/movies?q=Whina&date=today",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(fetch).toHaveBeenCalledWith(
      "/api/movie-previews?language=en&q=Whina&page=1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toBeVisible();
    expect(window.location.pathname + window.location.search).toBe("/movies?q=Whina");

    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/movies?q=Whina&date=weekend",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(window.location.pathname + window.location.search).toBe("/movies?q=Whina&date=weekend");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Movie, cinema, or suburb")).toHaveValue("");
  });

  it("switches to Chinese and refreshes only localized movie metadata", async () => {
    renderPage();
    await screen.findByText("No open-feed sessions found");
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "查找电影与已验证的奥克兰场次" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "奥克兰影院目录" })).toBeVisible();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/movie-previews?language=zh&page=1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
  });

  it("sorts cinemas by opt-in location and explains privacy", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: -36.8514, longitude: 174.7654 } as GeolocationCoordinates,
      timestamp: Date.now(),
    } as GeolocationPosition));
    vi.stubGlobal("navigator", { ...navigator, geolocation: { getCurrentPosition } });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Sort cinemas by my distance" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/0\.0 km away/)).toBeVisible();
    expect(screen.getByText("Your location stays on this device and is never saved.")).toBeVisible();
  });
});
