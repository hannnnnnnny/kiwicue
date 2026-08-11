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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    screenings: [], source: "open-cinema", sourceState: "empty",
  }), { status: 200, headers: { "content-type": "application/json" } })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("movies page", () => {
  it("puts search first and keeps the cinema directory useful when the feed is empty", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Movies playing around Auckland" })).toBeVisible();
    expect(screen.getByRole("search", { name: "Find a movie or cinema" })).toBeVisible();
    expect(await screen.findByText("No open-feed sessions found")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Auckland cinema directory" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Academy Cinemas sessions/ })).toHaveAttribute("href", "https://academycinemas.co.nz/");
  });

  it("submits a normalized search, changes date, and can clear the query", async () => {
    renderPage();
    await screen.findByText("No open-feed sessions found");
    fireEvent.change(screen.getByLabelText("Movie, cinema, or suburb"), { target: { value: "  Whina  " } });
    fireEvent.submit(screen.getByRole("search", { name: "Find a movie or cinema" }));

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/movies?q=Whina&date=today",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/movies?q=Whina&date=weekend",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByLabelText("Movie, cinema, or suburb")).toHaveValue("");
  });

  it("switches to Chinese without refetching", async () => {
    renderPage();
    await screen.findByText("No open-feed sessions found");
    const calls = vi.mocked(fetch).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "奥克兰现在有什么电影" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "奥克兰影院目录" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(calls);
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
