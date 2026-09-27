import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MovieDetailSessions } from "../components/movie-detail-sessions";
import type { KiwiCueScreening } from "../lib/movies";

const hoyts: KiwiCueScreening = {
  id: "hoyts-1002-1",
  filmId: "hoyts-HO1",
  filmTitle: "Fight Club",
  filmRating: "R16",
  runtimeMinutes: 139,
  cinemaId: "hoyts-1002",
  cinemaName: "HOYTS Sylvia Park",
  chain: "HOYTS",
  startTime: "2026-08-15T18:30:00+12:00",
  screenType: "Standard",
  formats: [],
  soldOut: false,
  discounted: false,
  bookingUrl: "https://www.hoyts.co.nz/orders/tickets?cinemaId=1002&sessionId=1",
  price: { minCents: 1900, maxCents: 2400, bookingFeeCents: 180 },
};
const hoytsLux: KiwiCueScreening = {
  ...hoyts, id: "hoyts-1002-2", startTime: "2026-08-15T21:00:00+12:00", screenType: "LUX",
  bookingUrl: "https://www.hoyts.co.nz/orders/tickets?cinemaId=1002&sessionId=2",
  price: { minCents: 2800, maxCents: 4300, bookingFeeCents: 345 },
};
const event: KiwiCueScreening = {
  ...hoyts, id: "event-9", cinemaId: "event-502", cinemaName: "EVENT Cinemas Queen Street", chain: "EVENT Cinemas",
  startTime: "2026-08-15T19:00:00+12:00", screenType: "Gold Class", discounted: true, formats: ["4K"],
  bookingUrl: "https://www.eventcinemas.co.nz/orders/tickets#sessionId=9", price: null,
};
const nextDay: KiwiCueScreening = { ...event, id: "event-10", startTime: "2026-08-16T19:00:00+12:00", discounted: false };

afterEach(cleanup);

function card(name: string): HTMLElement {
  return screen.getByRole("heading", { name }).closest("li") as HTMLElement;
}

describe("movie detail sessions", () => {
  it("lists each cinema showing the film with its price range and bookable times", () => {
    render(<MovieDetailSessions screenings={[hoyts, event, hoytsLux, nextDay]} sessionStatus="verified" checkedAt="2026-08-12T02:00:00.000Z" language="en" />);

    expect(screen.getByRole("heading", { name: "Where to watch in Auckland" })).toBeVisible();
    expect(screen.getByText(/2 cinemas · 4 sessions this week/)).toBeVisible();

    const sylvia = card("HOYTS Sylvia Park");
    expect(within(sylvia).getByText("$19.00 – $43.00 per ticket")).toBeVisible();
    expect(within(sylvia).getByText("+ $1.80 – $3.45 booking fee")).toBeVisible();
    expect(within(sylvia).getByRole("link", { name: /Book 9:00.*pm at HOYTS Sylvia Park/i })).toHaveAttribute("href", hoytsLux.bookingUrl);
    expect(within(sylvia).getByText("LUX")).toBeVisible();

    const queen = card("EVENT Cinemas Queen Street");
    expect(within(queen).getByText("Price shown when you book")).toBeVisible();
    expect(within(queen).getByText(/Half-price adult tickets on Tuesdays/)).toBeVisible();
    expect(within(queen).getByText("Gold Class")).toBeVisible();
    expect(within(queen).getByText("Half price")).toBeVisible();
    expect(within(queen).getAllByRole("link")).toHaveLength(1);
  });

  it("switches the cinema list when another date is chosen", () => {
    render(<MovieDetailSessions screenings={[hoyts, event, nextDay]} sessionStatus="verified" checkedAt={null} language="en" />);
    const dates = screen.getByRole("group", { name: "Choose a date" });
    const buttons = within(dates).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "HOYTS Sylvia Park" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "EVENT Cinemas Queen Street" })).toBeVisible();
  });

  it("never links sold-out sessions or untrusted booking URLs", () => {
    render(<MovieDetailSessions
      screenings={[{ ...hoyts, soldOut: true }, { ...hoytsLux, bookingUrl: "https://bad.example/checkout" }]}
      sessionStatus="verified" checkedAt={null} language="en"
    />);
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps no-match, partial and unavailable states distinct", () => {
    const { rerender } = render(<MovieDetailSessions screenings={[]} sessionStatus="unverified" checkedAt={null} unavailableChains={["EVENT Cinemas"]} language="en" />);
    expect(screen.getByText("Not showing at HOYTS or EVENT Cinemas this week")).toBeVisible();
    expect(screen.getByText(/EVENT Cinemas sessions could not be checked/)).toBeVisible();
    rerender(<MovieDetailSessions screenings={[]} sessionStatus="unavailable" checkedAt={null} language="en" />);
    expect(screen.getByText("Live sessions are temporarily unavailable")).toBeVisible();
  });

  it("renders the Chinese copy", () => {
    render(<MovieDetailSessions screenings={[hoyts]} sessionStatus="verified" checkedAt={null} language="zh" />);
    expect(screen.getByRole("heading", { name: "在奥克兰哪里看" })).toBeVisible();
    expect(screen.getByText("每张 $19.00 – $24.00")).toBeVisible();
  });
});
