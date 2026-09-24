import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoveryHub } from "../components/discovery-hub";
import { BookmarkProvider } from "../components/bookmark-provider";
import type { KiwiCueEvent } from "../lib/events";

const now = new Date("2026-09-26T05:00:00Z");
const events: KiwiCueEvent[] = [1, 2, 3].map(id => ({
  id: `event-${id}`, name: `Concert ${id}`, url: "https://example.com", imageUrl: null,
  start: { localDate: "2026-09-26", localTime: "20:00:00", dateTime: null, timezone: "Pacific/Auckland" },
  category: "Music", status: "onsale", venue: { id: `venue-${id}`, name: `Venue ${id}`, city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.85, longitude: 174.76 + id / 100 } },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState(null, "", "/"); });
function mount() { return render(<BookmarkProvider><DiscoveryHub events={events} language="en" now={now} /></BookmarkProvider>); }

describe("mobile discovery interactions", () => {
  it("expands a real stack and returns without losing available events", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Tonight · 3 loaded events" }));
    expect(screen.getByRole("heading", { name: /^Tonight$/ })).toBeVisible();
    expect(document.querySelectorAll(".discovery-feed article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Back to discovery" }));
    expect(document.querySelector(".discovery-feature")).toBeInTheDocument();
  });
  it("does not request location until the distance action is pressed", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /^Map$/ }));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sort by my distance" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Finding your location…" })).toBeDisabled();
  });
  it("keeps Auckland venues accessible when permission is denied", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, fail: () => void) => fail() } });
    mount(); fireEvent.click(screen.getByRole("button", { name: /^Map$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sort by my distance" }));
    expect(screen.getByRole("status")).toHaveTextContent("Location unavailable");
    expect(document.querySelectorAll(".discovery-feed article")).toHaveLength(3);
    expect(localStorage.length).toBe(0);
  });
  it("shows an honest empty free collection instead of inventing prices", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: /^Free$/ }));
    expect(screen.getByRole("status")).toHaveTextContent("No matching events in the loaded selection");
    expect(document.querySelectorAll(".discovery-feed article")).toHaveLength(0);
  });
  it("saves the featured event through the existing local bookmark store", () => {
    mount();
    const feature = document.querySelector<HTMLElement>(".discovery-feature")!;
    fireEvent.click(within(feature).getByRole("button", { name: "Save Concert 1" }));
    expect(within(feature).getByRole("button", { name: "Remove Concert 1 from saved events" })).toHaveAttribute("aria-pressed", "true");
  });
  it("surprise changes the featured real event", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Surprise me" }));
    expect(document.querySelector(".discovery-feature")).not.toHaveTextContent("Concert 1");
    expect(document.querySelector(".discovery-feature")).toHaveTextContent(/Concert [23]/);
  });
});
