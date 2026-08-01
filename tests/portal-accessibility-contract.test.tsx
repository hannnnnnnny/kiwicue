import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventsPageContent } from "../components/events-page-content";
import { LanguageProvider } from "../components/language-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const projectRoot = resolve(import.meta.dirname, "..");
const eventResult = {
  events: [{
    id: "event-1",
    name: "Harbour Lights",
    url: "https://www.ticketmaster.co.nz/event/event-1",
    imageUrl: null,
    start: {
      localDate: "2026-08-01",
      localTime: "19:30:00",
      dateTime: "2026-08-01T07:30:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: { id: "civic", name: "The Civic", city: "Auckland", address: "269 Queen Street" },
  }],
  page: { size: 50, totalElements: 1, totalPages: 1, number: 0 },
  nextCursor: null,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function isBefore(first: Element, second: Element) {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("complete portal accessibility contract", () => {
  it("keeps the shortest task path in a stable document order", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return new Response(JSON.stringify(url.includes("/api/venues")
        ? { venues: [{ id: "civic", name: "The Civic" }] }
        : eventResult), { status: 200, headers: { "content-type": "application/json" } });
    }));
    const view = render(
      <LanguageProvider>
        <EventsPageContent window="all" category={null} keyword={null} venueId={null} />
      </LanguageProvider>,
    );

    await screen.findByRole("heading", { name: "Harbour Lights" });
    const ordered = [
      view.container.querySelector(".skip-link"),
      view.container.querySelector(".portal-header"),
      screen.getByRole("search", { name: "Search Auckland events" }),
      screen.getByRole("navigation", { name: "Event categories" }),
      screen.getByRole("navigation", { name: "Event time range" }),
      view.container.querySelector("#event-results-summary"),
      view.container.querySelector(".event-grid"),
      view.container.querySelector(".portal-about"),
      view.container.querySelector(".portal-footer"),
    ];
    expect(ordered.every(Boolean)).toBe(true);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      expect(isBefore(ordered[index]!, ordered[index + 1]!)).toBe(true);
    }
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-label")))
      .toEqual(["Event categories", "Event time range"]);
  });

  it("names every action and never renders a dead link", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(
      JSON.stringify(String(input).includes("/api/venues") ? { venues: [] } : eventResult),
      { status: 200, headers: { "content-type": "application/json" } },
    )));
    const view = render(
      <LanguageProvider>
        <EventsPageContent window="all" category={null} keyword={null} venueId={null} />
      </LanguageProvider>,
    );
    await screen.findByRole("heading", { name: "Harbour Lights" });

    const interactive = Array.from(view.container.querySelectorAll<HTMLElement>("a, button, input, select"));
    expect(interactive.length).toBeGreaterThan(10);
    for (const element of interactive) {
      const labels = "labels" in element
        ? Array.from((element as HTMLInputElement).labels ?? []).map((label) => label.textContent).join(" ")
        : "";
      const name = element.getAttribute("aria-label") || labels || element.textContent || element.getAttribute("title") || "";
      expect(name.trim(), element.outerHTML).not.toBe("");
    }
    for (const link of view.container.querySelectorAll<HTMLAnchorElement>("a")) {
      expect(link.getAttribute("href"), link.outerHTML).toBeTruthy();
      expect(link.getAttribute("href"), link.outerHTML).not.toBe("#");
    }
  });

  it("locks in touch, focus, overflow, motion, and exact mobile-width rules", () => {
    const css = readFileSync(resolve(projectRoot, "app/globals.css"), "utf8");
    for (const selector of [
      ".portal-brand", ".language-toggle", ".event-search-input", ".event-search-select",
      ".event-search-submit", ".portal-nav-link", ".portal-event-link", ".event-load-more",
      ".portal-empty-action", ".saved-link", ".bookmark-button-card", ".bookmark-button-detail",
      ".event-detail-back", ".event-map figcaption a", ".distance-panel button",
      ".event-booking-inline", ".event-booking-action", ".saved-toolbar button",
    ]) {
      expect(css).toMatch(new RegExp(`${selector.replaceAll(".", "\\.")}[^}]*min-height:\\s*(?:56px|44px)`, "s"));
    }
    expect(css).toMatch(/:focus-visible[^}]*outline:[^;}]*var\(--portal-focus\)/s);
    expect(css).toMatch(/\.portal-nav-track\s*\{[^}]*overflow-x:\s*auto/s);
    expect(css).toMatch(/main\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toMatch(/@media \(max-width:\s*390px\)/);
    expect(css).toMatch(/@media \(max-width:\s*320px\)/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
  });
});
