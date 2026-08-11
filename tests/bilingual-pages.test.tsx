import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventsPage, { parseEventPageSearchParams } from "../app/events/page";
import { LanguageProvider } from "../components/language-provider";

const router = vi.hoisted(() => ({ push: vi.fn() }));

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
    });

    expect(parseEventPageSearchParams({
      q: ["Taylor", "Swift"],
      venue: ["one", "two"],
      category: ["concerts", "theatre"],
      window: ["7d", "30d"],
    })).toEqual({ window: "all", category: null, keyword: null, venueId: null });
  });

  it("switches the event-page framing without changing the data request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const page = await EventsPage();

    render(
      <LanguageProvider>
        {page}
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "What’s on in Auckland?" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Event categories" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Event time range" })).toBeInTheDocument();
    expect(screen.getByText("All future · Soonest first")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("Auckland events — KiwiCue"));
    expect(fetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "奥克兰最近有什么活动？" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "活动类型" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "时间范围" })).toBeInTheDocument();
    expect(screen.getByText("全部未来 · 最早发生优先")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toBeInTheDocument();
    expect(screen.getByLabelText("场馆")).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe("奥克兰活动 — KiwiCue"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.body).not.toHaveTextContent(/365|one year|一年|未来 365 天/i);
  });

  it("shows one validated category and ignores duplicated categories", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const filteredPage = await EventsPage({
      searchParams: Promise.resolve({ category: "concerts" }),
    });

    render(<LanguageProvider>{filteredPage}</LanguageProvider>);

    expect(screen.getByRole("link", { name: "Concerts" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/events");
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();

    cleanup();
    const invalidPage = await EventsPage({
      searchParams: Promise.resolve({ category: ["concerts", "theatre"] }),
    });
    render(<LanguageProvider>{invalidPage}</LanguageProvider>);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
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
