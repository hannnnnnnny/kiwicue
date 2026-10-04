import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoverFilters } from "../components/discover-filters";
import { EventSearchPanel } from "../components/event-search-panel";
import { BookmarkProvider } from "../components/bookmark-provider";
import { HomeContent } from "../components/home-content";
import { LanguageProvider } from "../components/language-provider";
import { PortalHeader } from "../components/portal-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const state = {
  window: "weekend" as const,
  category: "concerts" as const,
  keyword: "Taylor",
  venueId: "venue-1",
};

const homeEventResult = {
  events: [{
    id: "home-event",
    name: "Harbour Lights",
    url: "https://www.ticketmaster.co.nz/event/home-event",
    imageUrl: "https://example.com/harbour-lights.jpg",
    start: {
      localDate: "2026-08-21",
      localTime: "19:30:00",
      dateTime: "2026-08-21T07:30:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: {
      id: "civic",
      name: "The Civic",
      city: "Auckland",
      address: "269 Queen Street",
      postalCode: "1010",
      coordinates: null,
    },
  }],
  page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
  nextCursor: null,
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPortalControls() {
  render(
    <LanguageProvider>
      <PortalHeader />
      <EventSearchPanel {...state} />
      <DiscoverFilters state={{ ...state, sort: "recommended", free: false, view: "list" }} />
    </LanguageProvider>,
  );
}

describe("portal navigation", () => {
  it("puts event discovery and one live event in the homepage opening", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(homeEventResult), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    render(
      <LanguageProvider>
        <BookmarkProvider><HomeContent /></BookmarkProvider>
      </LanguageProvider>,
    );

    expect(screen.getByRole("link", { name: "Browse Auckland events" }))
      .toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "Skip to Auckland guide" }))
      .toHaveAttribute("href", "#home-content");
    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/events?window=30d&size=1",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("keeps the homepage useful when the live preview is empty or unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      events: [],
      page: { size: 1, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const emptyView = render(
      <LanguageProvider>
        <BookmarkProvider><HomeContent /></BookmarkProvider>
      </LanguageProvider>,
    );
    expect(await screen.findByText("New Auckland listings are being added.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Browse all events/ })).toHaveAttribute("href", "/events");
    emptyView.unmount();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(
      <LanguageProvider>
        <BookmarkProvider><HomeContent /></BookmarkProvider>
      </LanguageProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.getByRole("button", { name: "Retry event preview" })).toBeVisible();
  });

  it("replaces a broken homepage event image with the branded fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(homeEventResult), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    render(
      <LanguageProvider>
        <BookmarkProvider><HomeContent /></BookmarkProvider>
      </LanguageProvider>,
    );
    const image = await screen.findByRole("img", { name: "Harbour Lights event preview" });
    fireEvent.error(image);
    expect(screen.getByText("KiwiCue", { selector: ".home-feature-image-fallback" })).toBeVisible();
  });

  it("exposes one global navigation with an explicit current page", () => {
    render(
      <LanguageProvider>
        <PortalHeader currentPage="discover" />
      </LanguageProvider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    const primary = within(screen.getByRole("navigation", { name: "Primary navigation" }));
    expect(primary.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", { name: "Movies" })).toHaveAttribute("href", "/movies");
    expect(primary.getByRole("link", { name: "Mine: saved events, plans and collections. 0 saved" })).not.toHaveAttribute("aria-current");
  });

  it("uses the responsive KiwiCue artwork without duplicating its accessible name", () => {
    render(
      <LanguageProvider>
        <PortalHeader />
      </LanguageProvider>,
    );

    const homeLink = screen.getByRole("link", { name: "KiwiCue Auckland events home" });
    expect(homeLink.querySelector(".portal-brand-wordmark")).toHaveAttribute(
      "src",
      expect.stringContaining("kiwicue-wordmark.png"),
    );
    expect(homeLink.querySelector(".portal-brand-symbol")).toHaveAttribute(
      "src",
      expect.stringContaining("kiwicue-mark.png"),
    );
    expect(homeLink).not.toHaveTextContent(/^K$/);
  });

  it("marks the movie hub as current and keeps navigation order predictable", () => {
    render(
      <LanguageProvider>
        <PortalHeader currentPage="movies" skipTarget="movie-results" />
      </LanguageProvider>,
    );

    const links = screen.getByRole("navigation", { name: "Primary navigation" }).querySelectorAll("a");
    expect([...links].map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual(["Discover", "For You", "Movies", "Mine"]);
    const mobile = screen.getByRole("navigation", { name: "Mobile navigation" }).querySelectorAll("a");
    expect([...mobile].map((link) => link.getAttribute("href"))).toEqual([...links].map((link) => link.getAttribute("href")));
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", { name: "Movies" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Skip to movie sessions")).toHaveAttribute("href", "#movie-results");
  });

  it("preserves every other filter while one filter changes", () => {
    renderPortalControls();

    expect(screen.getByRole("link", { name: "KiwiCue Auckland events home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeInTheDocument();
    const what = within(screen.getByRole("navigation", { name: "What" }));
    expect(what.getByRole("link", { name: "Concerts" })).toHaveAttribute("aria-current", "true");
    expect(what.getByRole("link", { name: "Concerts" })).toHaveAttribute("href", "/events?window=weekend&q=Taylor&venue=venue-1");
    expect(what.getByRole("link", { name: "Markets" })).toHaveAttribute("href", "/events?window=weekend&category=markets&q=Taylor&venue=venue-1");
    expect(what.getByRole("link", { name: "Free" })).toHaveAttribute("href", "/events?window=weekend&category=concerts&q=Taylor&venue=venue-1&free=1");
    const when = within(screen.getByRole("navigation", { name: "When" }));
    expect(when.getByRole("link", { name: "This weekend" })).toHaveAttribute("aria-current", "true");
    expect(when.getByRole("link", { name: "Tonight" })).toHaveAttribute("href", "/events?window=tonight&category=concerts&q=Taylor&venue=venue-1");
    expect(within(screen.getByRole("navigation", { name: "View" })).getByRole("link", { name: "Map" }))
      .toHaveAttribute("href", "/events?window=weekend&category=concerts&q=Taylor&venue=venue-1&view=map");
  });

  it("switches every portal label to Chinese without refetching venues", () => {
    renderPortalControls();
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    const what = within(screen.getByRole("navigation", { name: "类型" }));
    for (const label of ["演唱会", "话剧演出", "市集", "节日活动", "体育赛事", "免费"]) {
      expect(what.getByRole("link", { name: label })).toBeInTheDocument();
    }
    const when = within(screen.getByRole("navigation", { name: "时间" }));
    for (const label of ["今晚", "本周末", "未来 7 天", "未来 30 天"]) {
      expect(when.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives every portal navigation target a real destination", () => {
    renderPortalControls();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^(?:\/$|\/(?:events|movies|for-you|saved)(?:\?|$)|#event-results$)/);
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });
});
