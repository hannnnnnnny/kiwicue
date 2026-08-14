import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCategoryNav } from "../components/event-category-nav";
import { EventSearchPanel } from "../components/event-search-panel";
import { EventWindowNav } from "../components/event-window-nav";
import { BookmarkProvider } from "../components/bookmark-provider";
import { HomeContent } from "../components/home-content";
import { LanguageProvider } from "../components/language-provider";
import { PortalHeader } from "../components/portal-header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
      <EventCategoryNav {...state} />
      <EventWindowNav {...state} />
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
        <PortalHeader currentPage="events" />
      </LanguageProvider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Movies" })).toHaveAttribute("href", "/movies");
    expect(screen.getByRole("link", { name: "Saved events, 0" })).not.toHaveAttribute("aria-current");
  });

  it("marks the movie hub as current and keeps navigation order predictable", () => {
    render(
      <LanguageProvider>
        <PortalHeader currentPage="movies" skipTarget="movie-results" />
      </LanguageProvider>,
    );

    const links = screen.getByRole("navigation", { name: "Primary navigation" }).querySelectorAll("a");
    expect([...links].map((link) => link.textContent?.replace(/\d+$/, ""))).toEqual(["Events", "Movies", "Saved"]);
    expect(screen.getByRole("link", { name: "Movies" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Skip to movie sessions")).toHaveAttribute("href", "#movie-results");
  });

  it("preserves every other filter while one navigation dimension changes", () => {
    renderPortalControls();

    expect(screen.getByRole("link", { name: "KiwiCue Auckland events home" }))
      .toHaveAttribute("href", "/");
    expect(screen.getByRole("search", { name: "Search Auckland events" }))
      .toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Event categories" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Concerts" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Markets" })).toHaveAttribute(
      "href",
      "/events?window=weekend&category=markets&q=Taylor&venue=venue-1",
    );
    expect(screen.getByRole("navigation", { name: "Event time range" }))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "This weekend" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Next 30 days" })).toHaveAttribute(
      "href",
      "/events?window=30d&category=concerts&q=Taylor&venue=venue-1",
    );
  });

  it("switches every portal label to Chinese without refetching venues", () => {
    renderPortalControls();
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "活动类型" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "时间范围" })).toBeInTheDocument();
    for (const label of [
      "全部", "演唱会", "话剧演出", "市集", "节日活动",
      "未来 7 天", "本周末", "未来 30 天", "全部未来",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("gives every portal navigation target a real destination", () => {
    renderPortalControls();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^(?:\/$|\/(?:events|movies|saved)(?:\?|$)|#event-results$)/);
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });
});
