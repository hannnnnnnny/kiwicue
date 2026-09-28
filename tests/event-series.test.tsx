import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventCard } from "../app/events/event-card";
import { BookmarkProvider } from "../components/bookmark-provider";
import { DiscoveryHub } from "../components/discovery-hub";
import { eventSectionId, groupEventSeries, groupSeriesBySection } from "../lib/event-series";
import type { KiwiCueEvent } from "../lib/events";

const now = new Date("2026-09-28T00:00:00Z");

function event(id: string, name: string, localDate: string, overrides: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id, name, url: "https://www.ticketmaster.co.nz/event/x", imageUrl: null,
    start: { localDate, localTime: "11:00:00", dateTime: null, timezone: "Pacific/Auckland" },
    status: "onsale", category: "Miscellaneous", tags: ["Family", "Other"],
    venue: { id: "herald", name: "Herald Theatre", city: "Auckland", address: null, postalCode: null, coordinates: { latitude: -36.85, longitude: 174.76 } },
    ...overrides,
  };
}

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

describe("event series grouping", () => {
  it("groups sessions of one show at one venue and keeps the earliest as the lead", () => {
    const series = groupEventSeries([
      event("b", "Kitchen Chaos!", "2026-09-30"),
      event("a", "Kitchen  chaos", "2026-09-29"),
      event("other-venue", "Kitchen Chaos!", "2026-09-29", { venue: { id: "civic", name: "The Civic", city: "Auckland", address: null, postalCode: null, coordinates: null } }),
      event("variant", "Kitchen Chaos! - Relaxed Performance", "2026-09-29"),
      event("b", "Kitchen Chaos!", "2026-09-30"),
    ]);
    expect(series.map(({ lead, events }) => [lead.id, events.map(({ id }) => id)])).toEqual([
      ["a", ["a", "b"]],
      ["other-venue", ["other-venue"]],
      ["variant", ["variant"]],
    ]);
  });

  it("sorts shows into sections, with family tags ahead of the upstream category", () => {
    expect(eventSectionId(event("1", "Show", "2026-09-29"))).toBe("family");
    expect(eventSectionId(event("2", "Gig", "2026-09-29", { category: "Music", tags: ["Rock"] }))).toBe("music");
    expect(eventSectionId(event("3", "Kids gig", "2026-09-29", { category: "Music", tags: ["Children's Music"] }))).toBe("family");
    expect(eventSectionId(event("4", "Play", "2026-09-29", { category: "Arts & Theatre", tags: ["Theatre"] }))).toBe("theatre");
    expect(eventSectionId(event("5", "Match", "2026-09-29", { category: "Sports", tags: [] }))).toBe("sports");
    expect(eventSectionId(event("6", "Tour", "2026-09-29", { tags: ["Community/Civic"] }))).toBe("other");
    const sections = groupSeriesBySection(groupEventSeries([
      event("6", "Tour", "2026-09-29", { tags: [] }),
      event("2", "Gig", "2026-09-29", { category: "Music", tags: [] }),
    ]));
    expect(sections.map(({ id }) => id)).toEqual(["music", "other"]);
  });
});

describe("grouped event cards", () => {
  it("shows the session count and links every session to its own page", () => {
    const sessions = [event("a", "Bundle Baby", "2026-09-29"), event("b", "Bundle Baby", "2026-09-30"), event("c", "Bundle Baby", "2026-10-04")];
    render(<BookmarkProvider><EventCard event={sessions[0]} sessions={sessions} index={0} language="en" variant="row" /></BookmarkProvider>);
    expect(screen.getByText("3 sessions · until Sun, 4 Oct")).toBeVisible();
    fireEvent.click(screen.getByText("All 3 sessions"));
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/events/a", "/events/b", "/events/c"]);
  });

  it("keeps a single-session card unchanged", () => {
    render(<BookmarkProvider><EventCard event={event("a", "Gig", "2026-09-29")} sessions={[event("a", "Gig", "2026-09-29")]} index={0} language="en" variant="row" /></BookmarkProvider>);
    expect(screen.queryByText(/sessions/)).not.toBeInTheDocument();
  });
});

describe("sectioned discovery feed", () => {
  it("collapses repeats, splits the feed by type and caps each section until expanded", () => {
    const repeats = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]
      .map((date, day) => event(`chaos-${day}`, "Kitchen Chaos!", date));
    const gigs = Array.from({ length: 8 }, (_, index) => event(`gig-${index}`, `Gig ${index}`, "2026-09-30", {
      category: "Music", tags: ["Rock"], venue: { id: `v${index}`, name: `Venue ${index}`, city: "Auckland", address: null, postalCode: null, coordinates: null },
    }));
    render(<BookmarkProvider><DiscoveryHub events={[...repeats, ...gigs]} language="en" now={now} /></BookmarkProvider>);

    const music = screen.getByRole("region", { name: "Music" });
    expect(within(music).getAllByRole("article")).toHaveLength(6);
    fireEvent.click(within(music).getByRole("button", { name: "Show all 8" }));
    expect(within(music).getAllByRole("article")).toHaveLength(8);

    const family = screen.getByRole("region", { name: "Family & kids" });
    expect(within(family).getAllByRole("article")).toHaveLength(1);
    expect(within(family).getByText(/^5 sessions · until/)).toBeVisible();
  });
});
