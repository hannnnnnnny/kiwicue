import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCategoryNav } from "../components/event-category-nav";
import { EventSearchPanel } from "../components/event-search-panel";
import { EventWindowNav } from "../components/event-window-nav";
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
  it("preserves every other filter while one navigation dimension changes", () => {
    renderPortalControls();

    expect(screen.getByRole("link", { name: "KiwiCue Auckland events home" }))
      .toHaveAttribute("href", "/events");
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
      expect(link.getAttribute("href")).toMatch(/^(?:\/events(?:\?|$)|#event-results$)/);
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });
});
