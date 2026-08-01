import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent } from "../lib/events";

const projectRoot = resolve(import.meta.dirname, "..");
const event: KiwiCueEvent = {
  id: "event-1",
  name: "Harbour Lights",
  url: "https://www.ticketmaster.co.nz/event/event-1",
  imageUrl: "https://img.example/harbour.jpg",
  start: {
    localDate: "2026-08-01",
    localTime: "19:30:00",
    dateTime: "2026-08-01T07:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "onsale",
  category: "Music",
  venue: { id: "venue-civic", name: "Civic Theatre", city: "Auckland", address: "269 Queen Street" },
};

afterEach(cleanup);

describe("portal event card", () => {
  it("makes one truthful, fully labelled official action from the complete card", () => {
    const view = render(<EventCard event={event} index={0} language="en" />);

    expect(screen.getByRole("article", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("Sat, 1 Aug · 7:30 pm")).toBeInTheDocument();
    expect(screen.getByText("Civic Theatre · Auckland")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open Harbour Lights official details" })).toHaveAttribute(
      "href",
      "https://www.ticketmaster.co.nz/event/event-1",
    );
    expect(screen.getByRole("link", { name: "Open Harbour Lights official details" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "Open Harbour Lights official details" })).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(view.container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("uses clear Chinese date, status, and fallback copy", () => {
    const view = render(<EventCard event={{ ...event, imageUrl: null }} index={8} language="zh" />);

    expect(screen.getByText("09")).toBeInTheDocument();
    expect(screen.getByText("8月1日周六 · 19:30")).toBeInTheDocument();
    expect(screen.getByText("售票中")).toBeInTheDocument();
    expect(screen.getByText("官方详情")).toBeInTheDocument();
    expect(screen.getByText("AKL")).toBeInTheDocument();
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
  });

  it("defines four, three, two, and one-column responsive grid contracts", () => {
    const css = readFileSync(resolve(projectRoot, "app/globals.css"), "utf8");
    expect(css).toMatch(/\.event-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
    expect(css).toMatch(/@media \(max-width:\s*1080px\)[\s\S]*\.event-grid\s*\{[^}]*repeat\(3,/s);
    expect(css).toMatch(/@media \(max-width:\s*700px\)[\s\S]*\.event-grid\s*\{[^}]*repeat\(2,/s);
    expect(css).toMatch(/@media \(max-width:\s*359px\)[\s\S]*\.event-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/\.portal-event-media\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
    expect(css).toMatch(/\.portal-event-link\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.portal-empty-action\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/main\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toMatch(/prefers-reduced-motion:[^)]+\)[\s\S]*\.portal-event-card:hover \.portal-event-media img[^}]*transform:\s*none/s);
  });
});
