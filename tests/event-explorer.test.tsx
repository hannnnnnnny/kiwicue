import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventExplorer } from "../app/events/event-explorer";

const projectRoot = resolve(import.meta.dirname, "..");
const eventResult = {
  events: [
    {
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
      venue: { name: "The Civic", city: "Auckland", address: "269 Queen Street" },
    },
  ],
  page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Auckland event explorer", () => {
  it("provides a route and a client-side explorer", () => {
    expect(existsSync(resolve(projectRoot, "app/events/page.tsx"))).toBe(true);
    expect(existsSync(resolve(projectRoot, "app/events/event-explorer.tsx"))).toBe(true);
  });

  it("exports the interactive event explorer", async () => {
    const explorerModule = await import("../app/events/event-explorer");
    expect(explorerModule.EventExplorer).toBeTypeOf("function");
  });

  it("frames the feed as an Auckland next-30-days briefing", async () => {
    const pageModule = await import("../app/events/page");
    expect(pageModule.default).toBeTypeOf("function");

    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const EventsPage = pageModule.default;
    render(<EventsPage />);

    expect(screen.getByRole("heading", { name: "What’s on, before it’s gone" })).toBeInTheDocument();
    expect(screen.getByText("Auckland · Next 30 days")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to KiwiCue home" })).toHaveAttribute("href", "/");
  });

  it("shows an immediate loading signal while Auckland events are requested", () => {
    const requestEvents = vi.fn(() => new Promise<never>(() => undefined));

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(screen.getByRole("status")).toHaveTextContent("Scanning Auckland for what is next");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(requestEvents).toHaveBeenCalledOnce();
  });

  it("renders useful event details and the official source link", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("Sat, 1 Aug")).toBeInTheDocument();
    expect(screen.getByText("7:30 pm")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("The Civic · Auckland")).toBeInTheDocument();
    expect(screen.getByText("1 event found · Soonest first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Harbour Lights on Ticketmaster" })).toHaveAttribute(
      "href",
      "https://www.ticketmaster.co.nz/event/event-1",
    );
  });

  it("explains an empty result without presenting it as an error", async () => {
    const requestEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
    });

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "Nothing on our radar yet" })).toBeInTheDocument();
    expect(screen.getByText("Try again soon—new Auckland events are added throughout the week.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a retry after a safe error and can recover", async () => {
    const requestEvents = vi.fn()
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce(eventResult);

    render(<EventExplorer requestEvents={requestEvents} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Auckland events are temporarily out of range");
    expect(alert).not.toHaveTextContent("private network details");

    fireEvent.click(screen.getByRole("button", { name: "Retry event scan" }));

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(requestEvents).toHaveBeenCalledTimes(2);
  });

  it("loads through the same-origin KiwiCue API instead of Ticketmaster", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(eventResult), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EventExplorer />);

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events?size=24",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("ticketmaster.com");
  });
});
