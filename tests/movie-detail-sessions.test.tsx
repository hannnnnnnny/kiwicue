import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MovieDetailSessions } from "../components/movie-detail-sessions";
import type { KiwiCueScreening } from "../lib/movies";

const session: KiwiCueScreening = {
  id: "session-1",
  filmId: "provider-film-id",
  filmTitle: "Fight Club",
  filmRating: "R16",
  runtimeMinutes: 139,
  cinemaId: "academy",
  cinemaName: "Academy Cinemas",
  startTime: "2026-08-15T18:30:00+12:00",
  formats: ["2D", "Captioned"],
  soldOut: false,
  distanceKilometres: null,
  bookingUrl: "https://academycinemas.co.nz/fight-club",
};

afterEach(cleanup);

describe("movie detail sessions", () => {
  it("shows source-matched cinema, date, time, formats, and an official booking action", () => {
    render(<MovieDetailSessions screenings={[session]} sessionStatus="verified" checkedAt="2026-08-12T02:00:00.000Z" language="en" />);

    expect(screen.getByRole("heading", { name: "Source-matched Auckland sessions" })).toBeVisible();
    expect(screen.getByText("Academy Cinemas")).toBeVisible();
    expect(screen.getByText(/Sat, 15 Aug/)).toBeVisible();
    expect(screen.getByText(/2D · Captioned/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Book on official site" })).toHaveAttribute("href", session.bookingUrl);
    expect(screen.getByText(/Checked .*confirm with the cinema/i)).toBeVisible();
  });

  it("does not render a booking CTA for sold-out or booking-unavailable sessions", () => {
    const { rerender } = render(<MovieDetailSessions screenings={[{ ...session, soldOut: true }]} sessionStatus="verified" checkedAt={null} language="en" />);
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Book on official site" })).not.toBeInTheDocument();

    rerender(<MovieDetailSessions screenings={[{ ...session, bookingUrl: null }]} sessionStatus="verified" checkedAt={null} language="en" />);
    expect(screen.getByText("Official booking link unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Book on official site" })).not.toBeInTheDocument();
  });

  it("keeps no-match, not-covered and unavailable states distinct", () => {
    const { rerender } = render(<MovieDetailSessions screenings={[]} sessionStatus="unverified" checkedAt={null} language="en" />);
    expect(screen.getByText("No source-title matches found")).toBeVisible();
    rerender(<MovieDetailSessions screenings={[]} sessionStatus="not-covered" checkedAt={null} language="en" />);
    expect(screen.getByText(/does not mean the film is not showing/i)).toBeVisible();
    rerender(<MovieDetailSessions screenings={[]} sessionStatus="unavailable" checkedAt={null} language="en" />);
    expect(screen.getByText("Session matching is temporarily unavailable")).toBeVisible();
  });

  it("filters sessions by cinema and date when selectors are useful", () => {
    const second = { ...session, id: "session-2", cinemaName: "The Capitol", startTime: "2026-08-16T18:30:00+12:00" };
    render(<MovieDetailSessions screenings={[session, second]} sessionStatus="verified" checkedAt={null} language="en" />);
    fireEvent.change(screen.getByLabelText("Cinema"), { target: { value: "The Capitol" } });
    expect(screen.getByRole("listitem")).toHaveTextContent("The Capitol");
    expect(screen.getByRole("listitem")).not.toHaveTextContent("Academy Cinemas");
  });

  it("shows a clear-filter action instead of a blank list after conflicting filters", () => {
    const second = { ...session, id: "session-2", cinemaName: "The Capitol", startTime: "2026-08-16T18:30:00+12:00" };
    render(<MovieDetailSessions screenings={[session, second]} sessionStatus="verified" checkedAt={null} language="en" />);
    fireEvent.change(screen.getByLabelText("Cinema"), { target: { value: "The Capitol" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-08-15" } });
    expect(screen.getByText("No sessions match these filters")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear session filters" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("does not make an unsafe direct booking URL clickable", () => {
    render(<MovieDetailSessions screenings={[{ ...session, bookingUrl: "https://bad.example/checkout" }]} sessionStatus="verified" checkedAt={null} language="en" />);
    expect(screen.getByText("Official booking link unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Book on official site" })).not.toBeInTheDocument();
  });
});
