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
    const previews = await screen.findByRole("heading", { name: "Recent New Zealand cinema releases" });
    expect(screen.getByRole("link", { name: "Preview Fight Club" })).toHaveAttribute("href", "/movies/550");
    const liveSessions = await screen.findByRole("heading", { name: "Live movie sessions" });
    expect(liveSessions.compareDocumentPosition(previews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("No open-feed sessions found")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Auckland cinema directory" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toHaveAttribute("href", "https://academycinemas.co.nz/");
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
