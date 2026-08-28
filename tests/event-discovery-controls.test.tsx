import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDiscoveryControls } from "../components/event-discovery-controls";
import { LanguageProvider } from "../components/language-provider";

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
});
