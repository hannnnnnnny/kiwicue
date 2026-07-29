import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import EventsPage, { parseEventPageSearchParams } from "../app/events/page";
import { LanguageProvider } from "../components/language-provider";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
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
    })).toEqual({
      category: "concerts",
      keyword: "Taylor Swift",
      venueId: "venue-1",
    });

    expect(parseEventPageSearchParams({
      q: ["Taylor", "Swift"],
      venue: ["one", "two"],
      category: ["concerts", "theatre"],
    })).toEqual({ category: null, keyword: null, venueId: null });
  });

  it("switches the home page from English to the approved Chinese identity", () => {
    render(
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "Auckland events, before you miss them" })).toBeInTheDocument();
    expect(screen.getByText("AKL — NEXT 365 DAYS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Concerts" })).toHaveAttribute(
      "href",
      "/events?category=concerts",
    );
    expect(screen.getByRole("link", { name: "Explore Theatre" })).toHaveAttribute(
      "href",
      "/events?category=theatre",
    );
    expect(screen.getByRole("link", { name: "Explore Markets" })).toHaveAttribute(
      "href",
      "/events?category=markets",
    );
    expect(screen.getByRole("link", { name: "Explore Festivals" })).toHaveAttribute(
      "href",
      "/events?category=festivals",
    );

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "在错过之前，发现奥克兰" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看奥克兰活动" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "查看演唱会" })).toHaveAttribute(
      "href",
      "/events?category=concerts",
    );
    expect(screen.getByRole("link", { name: "查看节日活动" })).toHaveAttribute(
      "href",
      "/events?category=festivals",
    );
    expect(screen.getByText("奥克兰首发")).toBeInTheDocument();
    expect(screen.getByText("奥克兰 — 未来 365 天")).toBeInTheDocument();
  });

  it("switches the event-page framing without changing the data request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const page = await EventsPage();

    render(
      <LanguageProvider>
        {page}
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "What’s on, before it’s gone" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "奥克兰有什么，别等错过才发现" })).toBeInTheDocument();
    expect(screen.getByText("奥克兰 · 未来 365 天")).toBeInTheDocument();
    expect(screen.getByText("每批最多 50 个")).toBeInTheDocument();
    expect(screen.getByText("最早发生优先")).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toBeInTheDocument();
    expect(screen.getByLabelText("场馆")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("shows one validated category and ignores duplicated categories", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const filteredPage = await EventsPage({
      searchParams: Promise.resolve({ category: "concerts" }),
    });

    render(<LanguageProvider>{filteredPage}</LanguageProvider>);

    expect(screen.getByText("Concerts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all events" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/events?category=concerts",
    );

    cleanup();
    const invalidPage = await EventsPage({
      searchParams: Promise.resolve({ category: ["concerts", "theatre"] }),
    });
    render(<LanguageProvider>{invalidPage}</LanguageProvider>);

    expect(screen.queryByRole("link", { name: "View all events" })).not.toBeInTheDocument();
  });
});
