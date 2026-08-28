import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventDiscoveryView, EventResultsView } from "../components/event-discovery-sections";
import type { KiwiCueEvent } from "../lib/events";

function event(id: string, day: number, free = false): KiwiCueEvent {
  return {
    id,
    name: `Event ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    start: {
      localDate: `2026-09-${String(day).padStart(2, "0")}`,
      localTime: "19:00:00",
      dateTime: `2026-09-${String(day).padStart(2, "0")}T07:00:00Z`,
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
    ...(free ? { admission: { kind: "free", currency: "NZD" } as const } : {}),
  };
}

afterEach(cleanup);

describe("editorial event discovery sections", () => {
  it("keeps past events out and reveals evidence-backed free collections", () => {
    render(<EventDiscoveryView
      events={[event("one", 1), event("two", 2), event("three", 3), event("four", 4), event("free", 5, true), event("past", 1)]}
      language="en"
      now={new Date("2026-09-01T12:00:00Z")}
    />);
    expect(screen.getByRole("heading", { name: "Free to enter" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Event free" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Event past" })).not.toBeInTheDocument();
  });

  it("localizes category names instead of exposing internal filter keys", () => {
    render(<EventDiscoveryView events={[event("one", 2)]} language="zh" now={new Date("2026-09-01T00:00:00Z")} />);
    expect(screen.getByRole("link", { name: "市集" })).toHaveAttribute("href", "/events?category=markets");
    expect(screen.queryByRole("link", { name: "markets" })).not.toBeInTheDocument();
  });

  it("keeps recommended and date sorting behavior distinct within a date", () => {
    const sparse = { ...event("a-sparse", 2), imageUrl: null };
    const complete = event("z-complete", 2);
    const state = { window: "all" as const, category: null, keyword: "music", venueId: null };
    const view = render(<EventResultsView events={[sparse, complete]} language="en" state={{ ...state, sort: "recommended" }} />);
    expect([...view.container.querySelectorAll(".portal-event-card h2")].map(({ textContent }) => textContent))
      .toEqual(["Event z-complete", "Event a-sparse"]);
    view.rerender(<EventResultsView events={[sparse, complete]} language="en" state={{ ...state, sort: "date" }} />);
    expect([...view.container.querySelectorAll(".portal-event-card h2")].map(({ textContent }) => textContent))
      .toEqual(["Event a-sparse", "Event z-complete"]);
  });
});
