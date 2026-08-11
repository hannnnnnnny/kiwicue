import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MovieScreeningFeed } from "../components/movie-screening-feed";
import type { KiwiCueScreening } from "../lib/movies";

const screening: KiwiCueScreening = {
  id: "screening-1",
  filmId: "film-1",
  filmTitle: "Whina",
  filmRating: "M",
  runtimeMinutes: 112,
  cinemaId: "academy",
  cinemaName: "Academy Cinemas",
  startTime: "2026-08-15T18:30:00+12:00",
  formats: ["2D", "English subtitles"],
  soldOut: false,
  distanceKilometres: 1.4,
  bookingUrl: "https://tickets.example/whina",
};

afterEach(cleanup);

describe("movie screening feed", () => {
  it("shows the decision-making facts and one official booking action", () => {
    render(<MovieScreeningFeed screenings={[screening]} state="ready" language="en" />);

    expect(screen.getByRole("heading", { name: "Whina" })).toBeVisible();
    expect(screen.getByText("Academy Cinemas")).toBeVisible();
    expect(screen.getByText(/Sat, 15 Aug/)).toBeVisible();
    expect(screen.getByText("M · 112 min")).toBeVisible();
    expect(screen.getByText("2D")).toBeVisible();
    expect(screen.getByText("1.4 km away")).toBeVisible();
    expect(screen.getByRole("link", { name: "Book on official site" })).toHaveAttribute(
      "href",
      "https://tickets.example/whina",
    );
  });

  it("shows a non-interactive sold-out state", () => {
    render(<MovieScreeningFeed screenings={[{ ...screening, soldOut: true }]} state="ready" language="en" />);
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Book on official site" })).not.toBeInTheDocument();
  });

  it("uses structure-matched loading rows and clear empty states", () => {
    const { rerender } = render(<MovieScreeningFeed screenings={[]} state="loading" language="en" />);
    expect(screen.getByLabelText("Loading movie sessions")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<MovieScreeningFeed screenings={[]} state="empty" language="en" />);
    expect(screen.getByText("No open-feed sessions found")).toBeVisible();

    rerender(<MovieScreeningFeed screenings={[]} state="unavailable" language="en" />);
    expect(screen.getByText("Live sessions are temporarily unavailable")).toBeVisible();
  });
});
