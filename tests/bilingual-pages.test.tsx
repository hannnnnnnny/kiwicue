import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventsPage, { parseEventPageSearchParams } from "../app/events/page";
import { LanguageProvider } from "../components/language-provider";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
  document.title = "";
  router.push.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bilingual route content", () => {
  it("parses one validated event search and venue filter", () => {
    expect(parseEventPageSearchParams({
      q: "  Taylor   Swift ",
      venue: "venue-1",
      category: "concerts",
      window: "weekend",
    })).toEqual({
      window: "weekend",
      category: "concerts",
      keyword: "Taylor Swift",
      venueId: "venue-1",
      sort: "recommended",
      free: false,
      view: "list",
    });

    expect(parseEventPageSearchParams({
      q: ["Taylor", "Swift"],
      venue: ["one", "two"],
      category: ["concerts", "theatre"],
      window: ["7d", "30d"],
    })).toEqual({ window: "all", category: null, keyword: null, venueId: null, sort: "recommended", free: false, view: "list" });
    expect(parseEventPageSearchParams({ free: "1", view: "map", window: "tonight" })).toMatchObject({ free: true, view: "map", window: "tonight" });
  });

  it("switches the event-page framing without changing the data request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const page = await EventsPage();

    render(
      <LanguageProvider>
        {page}
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "What do you feel like?" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "When" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "What" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "View" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Auckland events — KiwiCue"));
    expect(fetch).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "今天，想做点什么？" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "时间" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "类型" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toBeInTheDocument();
    expect(screen.getByLabelText("场馆")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("奥克兰活动 — KiwiCue"));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(document.body).not.toHaveTextContent(/365|one year|一年|未来 365 天/i);
  });

  it("shows one validated category and ignores duplicated categories", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const filteredPage = await EventsPage({
      searchParams: Promise.resolve({ category: "concerts" }),
    });

    render(<LanguageProvider>{filteredPage}</LanguageProvider>);

    const categoryNav = screen.getByRole("navigation", { name: "What" });
    expect(within(categoryNav).getByRole("link", { name: "Concerts" })).toHaveAttribute("aria-current", "true");
    // Tapping the chosen category again clears it.
    expect(within(categoryNav).getByRole("link", { name: "Concerts" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "Clear all" })).toHaveAttribute("href", "/events");

    cleanup();
    const invalidPage = await EventsPage({
      searchParams: Promise.resolve({ category: ["concerts", "theatre"] }),
    });
    render(<LanguageProvider>{invalidPage}</LanguageProvider>);

    const invalidCategoryNav = screen.getByRole("navigation", { name: "What" });
    expect(within(invalidCategoryNav).queryAllByRole("link").filter((link) => link.getAttribute("aria-current"))).toHaveLength(0);
  });

  it("keeps date-only sorting visible with its search controls", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const sortedPage = await EventsPage({ searchParams: Promise.resolve({ sort: "date" }) });
    const view = render(<LanguageProvider>{sortedPage}</LanguageProvider>);

    expect(view.container.querySelector(".discovery-search")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeVisible();
    expect(view.container.querySelector(".portal-command")).toHaveAttribute("data-filtered", "true");
    expect(screen.getByText("All future · Soonest first")).toBeInTheDocument();
  });

  it("labels the market source as KiwiCue-verified instead of Ticketmaster", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const marketPage = await EventsPage({
      searchParams: Promise.resolve({ category: "markets" }),
    });

    render(<LanguageProvider>{marketPage}</LanguageProvider>);

    expect(screen.getByText("KiwiCue verified schedules")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Ticketmaster source");
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
    expect(screen.getByText("KiwiCue 已核实日程")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Ticketmaster 官方来源");
  });

  it("shows a category-preserving clear link for either applied search filter", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const keywordPage = await EventsPage({
      searchParams: Promise.resolve({ window: "weekend", category: "concerts", q: "Taylor" }),
    });

    render(<LanguageProvider>{keywordPage}</LanguageProvider>);
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/events?window=weekend&category=concerts",
    );

    cleanup();
    const venuePage = await EventsPage({
      searchParams: Promise.resolve({ category: "concerts", venue: "venue-1" }),
    });
    render(<LanguageProvider>{venuePage}</LanguageProvider>);

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/events?category=concerts",
    );
  });
});
