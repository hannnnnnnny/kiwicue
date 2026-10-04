import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoveryHub } from "../components/discovery-hub";
import { BookmarkProvider } from "../components/bookmark-provider";
import { EventMapView } from "../components/event-map-view";
import type { KiwiCueEvent } from "../lib/events";

const now = new Date("2026-09-26T05:00:00Z");
const events: KiwiCueEvent[] = [1, 2, 3].map(id => ({
  id: `event-${id}`, name: `Concert ${id}`, url: "https://example.com", imageUrl: null,
  start: { localDate: "2026-09-26", localTime: "20:00:00", dateTime: null, timezone: "Pacific/Auckland" },
  category: "Music", status: "onsale", venue: { id: `venue-${id}`, name: `Venue ${id}`, city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.85, longitude: 174.76 + id / 100 } },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
function mount() { return render(<BookmarkProvider><DiscoveryHub events={events} language="en" now={now} /></BookmarkProvider>); }
function mountMap() { return render(<BookmarkProvider><EventMapView events={events} language="en" /></BookmarkProvider>); }

describe("discovery hub", () => {
  it("previews popular filters and opens them as filtered lists", () => {
    mount();
    expect(screen.getByRole("link", { name: "Tonight · 3 events" })).toHaveAttribute("href", "/events?window=tonight");
    expect(screen.getAllByRole("link", { name: "See all" }).map((link) => link.getAttribute("href"))).toContain("/events?category=concerts");
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

describe("map view", () => {
  it("does not request location until the distance action is pressed", () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    mountMap();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sort by my distance" }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Finding your location…" })).toBeDisabled();
  });
  it("keeps Auckland venues accessible when permission is denied", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: unknown, fail: () => void) => fail() } });
    mountMap();
    fireEvent.click(screen.getByRole("button", { name: "Sort by my distance" }));
    expect(screen.getByRole("status")).toHaveTextContent("Location unavailable");
    expect(document.querySelectorAll(".discovery-feed article")).toHaveLength(3);
    expect(localStorage.length).toBe(0);
  });
  it("lets visitors inspect another event's venue without asking for their location", () => {
    mountMap();
    expect(screen.getByTitle("Map of Venue 1")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Choose an event on the map" }), { target: { value: "event-2" } });
    expect(screen.getByTitle("Map of Venue 2")).toBeInTheDocument();
    expect(screen.queryByTitle("Map of Venue 1")).not.toBeInTheDocument();
  });
  it("says so when nothing in the list has a mapped venue", () => {
    render(<BookmarkProvider><EventMapView events={events.map((event) => ({ ...event, venue: null }))} language="en" /></BookmarkProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("None of these events has a mapped venue.");
  });
});
