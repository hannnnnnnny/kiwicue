import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import { RecommendationsPageContent, type RecommendationFeedRequest } from "../components/recommendations-page-content";
import { BOOKMARK_STORAGE_KEY, serializeBookmarks } from "../lib/bookmarks";
import type { KiwiCueEvent } from "../lib/events";

const NOW = new Date("2026-08-28T00:00:00.000Z");

function event(id: string, dateTime: string, category = "Music"): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: { localDate: dateTime.slice(0, 10), localTime: "19:00:00", dateTime, timezone: "Pacific/Auckland" },
    status: "onsale",
    category,
    venue: { id: `venue-${id}`, name: `Venue ${id}`, city: "Auckland", address: null, postalCode: null, coordinates: null },
  };
}

function renderPage(requestFeed: RecommendationFeedRequest) {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <RecommendationsPageContent requestFeed={requestFeed} now={() => NOW} />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("RecommendationsPageContent", () => {
  it("shows loading then distinct, explained recommendation sections", async () => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([{
      event: event("saved", "2026-09-20T07:00:00.000Z"),
      savedAt: "2026-08-27T00:00:00.000Z",
    }]));
    const requestFeed = vi.fn<RecommendationFeedRequest>(async (feed) => feed === "events"
      ? [
          event("weekend", "2026-08-29T07:00:00.000Z", "Sports"),
          event("familiar", "2026-09-10T07:00:00.000Z"),
          event("theatre", "2026-09-12T07:00:00.000Z", "Arts & Theatre"),
        ]
      : [event("market", "2026-09-13T07:00:00.000Z", "Market")]);

    renderPage(requestFeed);
    expect(screen.getByRole("status")).toHaveTextContent("Building your Auckland shortlist");

    expect(await screen.findByRole("heading", { name: "Start here" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Picks" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "This weekend" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Try something different" })).toBeInTheDocument();
    expect(screen.getByText("Matches what you save")).toBeInTheDocument();
    expect(screen.getByText(/Your saved events stay in this browser/)).toBeInTheDocument();
    expect(requestFeed).toHaveBeenCalledTimes(2);
  });

  it("keeps useful results visible when one feed fails", async () => {
    const requestFeed = vi.fn<RecommendationFeedRequest>(async (feed) => {
      if (feed === "markets") throw new Error("unavailable");
      return [event("available", "2026-09-05T07:00:00.000Z")];
    });

    renderPage(requestFeed);

    expect(await screen.findByText("Some recommendations could not be refreshed.")).toBeInTheDocument();
    expect(screen.getByText("Event available")).toBeInTheDocument();
  });

  it("shows an actionable error and retries both feeds", async () => {
    const requestFeed = vi.fn<RecommendationFeedRequest>()
      .mockRejectedValueOnce(new Error("events unavailable"))
      .mockRejectedValueOnce(new Error("markets unavailable"))
      .mockResolvedValueOnce([event("recovered", "2026-09-05T07:00:00.000Z")])
      .mockResolvedValueOnce([]);

    renderPage(requestFeed);
    expect(await screen.findByRole("heading", { name: "Recommendations are temporarily unavailable" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Event recovered")).toBeInTheDocument();
    expect(requestFeed).toHaveBeenCalledTimes(4);
  });

  it("shows an empty state with a route back to the full event finder", async () => {
    renderPage(async () => []);

    expect(await screen.findByRole("heading", { name: "No fresh picks yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all events" })).toHaveAttribute("href", "/events");
  });

  it("switches recommendation copy to Chinese without refetching", async () => {
    const requestFeed = vi.fn<RecommendationFeedRequest>(async () => [event("one", "2026-09-05T07:00:00.000Z")]);
    renderPage(requestFeed);
    await screen.findByText("Event one");

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "为你推荐" })).toBeInTheDocument();
    expect(screen.getByText(/收藏只保存在当前浏览器/)).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("奥克兰活动推荐 — KiwiCue"));
    expect(requestFeed).toHaveBeenCalledTimes(2);
  });
});
