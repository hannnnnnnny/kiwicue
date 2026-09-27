import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovieScreeningFeed } from "../components/movie-screening-feed";
import type { MovieShowing } from "../lib/movies";

const film: MovieShowing = {
  id: "whina",
  title: "Whina",
  rating: "M",
  runtimeMinutes: 112,
  cinemaCount: 3,
  sessionCount: 11,
  nextStartTime: "2026-08-15T18:30:00+12:00",
  nextCinemaName: "HOYTS Sylvia Park",
  screenTypes: ["LUX", "Standard"],
};

afterEach(cleanup);

describe("movie screening feed", () => {
  it("summarises each film and links to its detail page when the film is known", () => {
    render(<MovieScreeningFeed films={[film]} state="ready" language="en" checkedAt="2026-08-12T02:00:00.000Z"
      unavailableChains={[]} movieIds={new Map([["whina", 42]])} onFind={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Whina" })).toBeVisible();
    expect(screen.getByText("M · 112 min")).toBeVisible();
    expect(screen.getByText("3 cinemas · 11 sessions")).toBeVisible();
    expect(screen.getByText(/Next: Sat, 15 Aug.*HOYTS Sylvia Park/)).toBeVisible();
    expect(screen.getByText("LUX")).toBeVisible();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Cinemas, times & prices/ })).toHaveAttribute("href", "/movies/42");
    expect(screen.getByText(/Updated/)).toBeVisible();
  });

  it("offers a search for films without a known detail page", () => {
    const onFind = vi.fn();
    render(<MovieScreeningFeed films={[film]} state="ready" language="en" checkedAt={null} unavailableChains={[]} movieIds={new Map()} onFind={onFind} />);
    fireEvent.click(screen.getByRole("button", { name: "Find this film" }));
    expect(onFind).toHaveBeenCalledWith("Whina");
  });

  it("shows the first twelve films and reveals the rest on request", () => {
    const films = Array.from({ length: 15 }, (_, index) => ({ ...film, id: `film-${index}`, title: `Film ${index}` }));
    render(<MovieScreeningFeed films={films} state="ready" language="en" checkedAt={null} unavailableChains={[]} movieIds={new Map()} onFind={vi.fn()} />);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show all 15 films" }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(15);
  });

  it("warns when one chain is missing from the list", () => {
    render(<MovieScreeningFeed films={[film]} state="ready" language="en" checkedAt={null} unavailableChains={["HOYTS"]} movieIds={new Map()} onFind={vi.fn()} />);
    expect(screen.getByText(/HOYTS sessions are temporarily unavailable/)).toBeVisible();
  });

  it("uses structure-matched loading rows and clear empty states", () => {
    const props = { language: "en" as const, checkedAt: null, unavailableChains: [], movieIds: new Map(), onFind: vi.fn() };
    const { rerender } = render(<MovieScreeningFeed films={[]} state="loading" {...props} />);
    expect(screen.getByLabelText("Loading Auckland sessions")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<MovieScreeningFeed films={[]} state="empty" {...props} />);
    expect(screen.getByText("No sessions found for this date")).toBeVisible();

    rerender(<MovieScreeningFeed films={[]} state="unavailable" {...props} />);
    expect(screen.getByText("Live sessions are temporarily unavailable")).toBeVisible();
  });
});
