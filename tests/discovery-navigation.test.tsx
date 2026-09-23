import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DiscoveryHub } from "../components/discovery-hub";
import { PortalHeader } from "../components/portal-header";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import type { KiwiCueEvent } from "../lib/events";

const events: KiwiCueEvent[] = [1, 2].map(id => ({
  id: String(id), name: `Show ${id}`, url: "https://example.com", imageUrl: null,
  start: { localDate: "2026-09-26", localTime: "20:00:00", dateTime: null, timezone: "Pacific/Auckland" },
  category: "Music", status: "onsale", venue: { id: String(id), name: `Venue ${id}`, city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.85, longitude: 174.76 + id / 100 } },
}));
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState(null, "", "/"); });
function mount() {
  return render(<LanguageProvider><BookmarkProvider><PortalHeader /><DiscoveryHub events={events} language="en" now={new Date("2026-09-26T05:00:00Z")} /></BookmarkProvider></LanguageProvider>);
}
it("synchronizes collection, history hash, and mobile active navigation", () => {
  window.history.replaceState(null, "", "/events#map"); mount();
  const navigation = within(screen.getByRole("navigation", { name: "Mobile navigation" }));
  expect(navigation.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: /Back to discovery/ }));
  expect(window.location.hash).toBe("");
  expect(navigation.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(navigation.getByRole("link", { name: "Map" }));
  expect(screen.getByRole("heading", { name: "Around Auckland" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Tonight", exact: true }));
  expect(window.location.hash).toBe("#tonight");
  act(() => { window.history.replaceState(null, "", "/events#map"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(screen.getByRole("heading", { name: "Around Auckland" })).toBeVisible();
});
it("lets users inspect another event venue without requesting their location", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Nearby", exact: true }));
  expect(screen.getByTitle("Map of Venue 1")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Choose an event on the map" }), { target: { value: "2" } });
  expect(screen.getByTitle("Map of Venue 2")).toBeInTheDocument();
  expect(screen.queryByTitle("Map of Venue 1")).not.toBeInTheDocument();
});
