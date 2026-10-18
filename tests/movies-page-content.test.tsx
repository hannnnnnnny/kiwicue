import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import { MoviesPageContent } from "../components/movies-page-content";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

function showing(title: string, overrides: Record<string, unknown> = {}) {
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), title, rating: "R16", runtimeMinutes: 139,
    cinemaCount: 2, sessionCount: 5, nextStartTime: "2026-08-15T08:00:00.000Z", nextCinemaName: "HOYTS Sylvia Park",
    screenTypes: ["Standard"], ...overrides,
  };
}

function feed(films: unknown[], sourceState = films.length > 0 ? "ready" : "empty") {
  return { films, sourceState, unavailableChains: [], checkedAt: "2026-08-12T02:00:00.000Z" };
}

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
      : feed([]);
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
    expect(screen.getByRole("heading", { name: "Movies playing in Auckland" })).toBeVisible();
    expect(screen.getByRole("search", { name: "Find a movie or cinema" })).toBeVisible();
    const previews = await screen.findByRole("heading", { name: "Explore recent New Zealand releases" });
    expect(screen.getByRole("link", { name: "Preview Fight Club" })).toHaveAttribute("href", "/movies/550");
    expect(screen.getByText("Not found at HOYTS or EVENT")).toBeVisible();
    const liveSessions = await screen.findByRole("heading", { name: "Now showing in Auckland" });
    expect(liveSessions.compareDocumentPosition(previews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("No sessions found for this date")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Auckland cinema directory" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toHaveAttribute("href", "https://academycinemas.co.nz/");
  });

  it("prioritizes official cinema links when live sessions are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const payload = String(input).startsWith("/api/movie-previews")
        ? { movies: [], page: { number: 1, totalPages: 1, totalResults: 0 } }
        : feed([], "unavailable");
      return Promise.resolve(Response.json(payload));
    }));

    renderPage();

    const directory = await screen.findByRole("heading", { name: "Auckland cinema directory" });
    expect(screen.getByRole("heading", { name: "Find an Auckland cinema" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Choose a date" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Now showing in Auckland" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toBeVisible();
    const previews = screen.getByRole("heading", { name: "Explore recent New Zealand releases" });
    expect(directory.compareDocumentPosition(previews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks a showing preview and links the live film straight to its detail page", async () => {
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
        : feed([showing("Fight Club"), showing("Local Only")]);
      return Promise.resolve(Response.json(payload));
    }));

    renderPage();

    expect(await screen.findByRole("link", { name: "Preview Fight Club" })).toHaveAttribute("href", "/movies/550");
    expect(await screen.findByText("Showing in Auckland")).toBeVisible();
    expect(screen.getByRole("link", { name: /Cinemas, times & prices/ })).toHaveAttribute("href", "/movies/550");

    fireEvent.click(screen.getByRole("button", { name: "Find this film" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/movie-previews?language=en&q=Local+Only&page=1",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(screen.getByLabelText("Movie, cinema, or suburb")).toHaveValue("Local Only");
  });

  it("opens a film's page straight away when Find this film finds it", async () => {
    push.mockClear();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/movies")) return Promise.resolve(Response.json(feed([showing("Local Only")])));
      const movies = url.includes("q=Local+Only")
        ? [{ id: 77, title: "Local Only", originalTitle: null, overview: "", posterUrl: null, releaseDate: "2026-10-01", rating: 7, ratingCount: 10 }]
        : [];
      return Promise.resolve(Response.json({ movies, page: { number: 1, totalPages: 1, totalResults: movies.length } }));
    }));

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Find this film" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/movies/77"));
  });

  it("keeps a verified preview when Chinese localization changes every visible title", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/movies")) {
        return Promise.resolve(Response.json(feed([showing("Detective Conan: Fallen Angel of the Highway")])));
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
    expect(await screen.findByText("奥克兰有场次")).toBeVisible();
  });

  it("submits a normalized search, changes date, and can clear the query", async () => {
    renderPage();
    await screen.findByText("No sessions found for this date");
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
    await screen.findByText("No sessions found for this date");
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "奥克兰正在上映的电影" })).toBeVisible();
    expect(document.title).toBe("奥克兰电影 — KiwiCue");
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
