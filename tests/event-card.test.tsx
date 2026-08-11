import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent } from "../lib/events";
import { readApplicationCss } from "./css-source";

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
  venue: {
    id: "venue-civic",
    name: "Civic Theatre",
    city: "Auckland",
    address: "269 Queen Street",
    postalCode: "1010",
    coordinates: { latitude: -36.8505, longitude: 174.7645 },
  },
};

const curatedMarket: KiwiCueEvent = {
  ...event,
  id: "kc-market-grey-lynn",
  name: "Grey Lynn Farmers Market",
  imageUrl: null,
  status: "schedule_verified",
  category: "Market",
  localization: {
    zh: {
      name: "Grey Lynn 农夫市集",
      previewSummary: "由社区运营，可以直接向本地种植者购买。",
      previewHighlights: ["本地农产品", "社区食品商家", "减少废弃物"],
      previewImageAlt: "Grey Lynn 农夫市集里的本地农产品",
    },
  },
  editorialPreview: {
    summary: "A community market where local growers sell directly.",
    highlights: ["Local produce", "Small food makers", "Low-waste focus"],
    image: {
      url: "https://images.example/grey-lynn.jpg",
      alt: "Fresh produce at Grey Lynn Farmers Market",
      sourceName: "Grey Lynn Farmers Market",
      sourceUrl: "https://www.greylynnfarmersmarket.co.nz/",
      verifiedAt: "2026-08-12",
    },
  },
};

afterEach(cleanup);

describe("portal event card", () => {
  it("makes one truthful, fully labelled internal details action from the complete card", () => {
    const view = render(<EventCard event={event} index={0} language="en" />);

    expect(screen.getByRole("article", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("Sat, 1 Aug · 7:30 pm")).toBeInTheDocument();
    expect(screen.getByText("Civic Theatre · Auckland")).toBeInTheDocument();
    expect(screen.queryByText(/price|价格|NZ\$/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View Harbour Lights details" })).toHaveAttribute(
      "href",
      "/events/event-1",
    );
    expect(screen.getByRole("link", { name: "View Harbour Lights details" })).not.toHaveAttribute("target");
    expect(view.container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("uses clear Chinese date and omits empty generic media", () => {
    const view = render(<EventCard event={{ ...event, imageUrl: null }} index={8} language="zh" />);

    expect(screen.getByText("09")).toBeInTheDocument();
    expect(screen.getByText("8月1日周六 · 19:30")).toBeInTheDocument();
    expect(screen.getByText("售票中")).toBeInTheDocument();
    expect(screen.getByText("音乐")).toBeInTheDocument();
    expect(screen.queryByText("Music")).not.toBeInTheDocument();
    expect(screen.getByText("查看详情")).toBeInTheDocument();
    expect(screen.queryByText("AKL")).not.toBeInTheDocument();
    expect(view.container.querySelector(".portal-event-media")).not.toBeInTheDocument();
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows localized useful text when a market preview image fails", () => {
    const view = render(<EventCard event={curatedMarket} index={0} language="zh" />);

    fireEvent.error(view.container.querySelector("img")!);

    expect(screen.getByText("第一次去可以期待")).toBeInTheDocument();
    expect(screen.getByText("由社区运营，可以直接向本地种植者购买。")).toBeInTheDocument();
    expect(screen.queryByText("AKL")).not.toBeInTheDocument();
  });

  it("uses the localized market name and verified schedule label in Chinese", () => {
    render(<EventCard event={curatedMarket} index={0} language="zh" />);

    expect(screen.getByRole("article", { name: "Grey Lynn 农夫市集" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Grey Lynn 农夫市集" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 Grey Lynn 农夫市集 详情" })).toHaveAttribute(
      "href",
      "/events/kc-market-grey-lynn",
    );
    expect(screen.getByText("市集")).toBeInTheDocument();
    expect(screen.getByText("日程已核实")).toBeInTheDocument();
  });

  it("defines four, three, two, and one-column responsive grid contracts", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/\.event-grid,[\s\S]*?grid-template-columns:\s*repeat\(4,/s);
    expect(css).toMatch(/@media \(max-width:\s*1100px\)[\s\S]*\.event-grid[^}]*repeat\(3,/s);
    expect(css).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.event-grid[^}]*repeat\(2,/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*\.event-grid[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/\.portal-event-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*10/s);
    expect(css).toMatch(/\.portal-event-link\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.event-state button,[\s\S]*?\.portal-empty-action,[\s\S]*?min-height:\s*52px/s);
    expect(css).not.toMatch(/main\s*\{[^}]*overflow-x:\s*clip/s);
    expect(css).toMatch(/prefers-reduced-motion:[^)]+\)[\s\S]*\.portal-event-card:hover \.portal-event-media img[^}]*transform:\s*none/s);
  });
});
