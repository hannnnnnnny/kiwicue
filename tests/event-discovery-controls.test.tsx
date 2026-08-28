import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDiscoveryControls } from "../components/event-discovery-controls";
import { LanguageProvider } from "../components/language-provider";
import { LanguageToggle } from "../components/language-toggle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("event discovery controls", () => {
  it("exposes removable active filters, sort and clear-all links", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    render(
      <LanguageProvider>
        <EventDiscoveryControls state={{ window: "weekend", category: "concerts", keyword: "Jazz", venueId: null, sort: "date" }} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("link", { name: "Remove Jazz filter" })).toHaveAttribute(
      "href",
      "/events?window=weekend&category=concerts&sort=date",
    );
    expect(screen.getByRole("link", { name: "Sort by recommended" })).toHaveAttribute(
      "href",
      "/events?window=weekend&category=concerts&q=Jazz",
    );
    expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute("href", "/events");
  });

  it("uses bilingual human labels instead of internal filter IDs", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    render(
      <LanguageProvider>
        <LanguageToggle />
        <EventDiscoveryControls state={{ window: "30d", category: "markets", keyword: null, venueId: "kc-venue-grey-lynn", sort: "recommended" }} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("link", { name: "Remove Markets filter" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Remove Next 30 days filter" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Remove Selected venue filter" })).toBeVisible();
    expect(screen.queryByText("kc-venue-grey-lynn")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
    expect(screen.getByRole("link", { name: "移除市集筛选" })).toBeVisible();
    expect(screen.getByRole("link", { name: "移除未来 30 天筛选" })).toBeVisible();
    expect(screen.getByRole("link", { name: "移除所选场馆筛选" })).toBeVisible();
  });
});
