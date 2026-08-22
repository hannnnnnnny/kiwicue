import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CinemaDirectory } from "../components/cinema-directory";
import { AUCKLAND_CINEMAS } from "../lib/cinema-directory";

afterEach(cleanup);

describe("cinema directory brand marks", () => {
  it("renders official local marks and initials fallbacks", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    expect(screen.getByTestId("cinema-brand-academy").querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("academy.png"),
    );
    expect(screen.getByTestId("cinema-brand-silky-otter-orakei")).toHaveTextContent("SO");
    expect(screen.getByTestId("cinema-brand-event-queen-street").querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("event.svg"),
    );
  });

  it("puts Reading's official white wordmark on a dark brand backing without modifying the asset", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    expect(screen.getByTestId("cinema-brand-reading-lynnmall")).toHaveClass("cinema-brand-mark-dark");
  });

  it("replaces an unavailable official mark with its initials", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    fireEvent.error(screen.getByTestId("cinema-brand-academy").querySelector("img")!);

    expect(screen.getByTestId("cinema-brand-academy")).toHaveTextContent("AC");
    expect(screen.getByTestId("cinema-brand-academy").querySelector("img")).not.toBeInTheDocument();
  });

  it("groups each cinema mark with its text identity", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    const academyIdentity = screen.getByTestId("cinema-brand-academy").parentElement;

    expect(document.querySelectorAll(".cinema-directory-identity")).toHaveLength(AUCKLAND_CINEMAS.length);
    expect(academyIdentity).toHaveClass("cinema-directory-identity");
    expect(academyIdentity).toHaveTextContent("Academy Cinemas");
  });

  it("keeps accessible actions while marking decorative icons as hidden", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    expect(screen.getByRole("link", { name: "Academy Cinemas sessions" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Map for Academy Cinemas" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    const ticketIcon = screen.getByRole("link", { name: "Academy Cinemas sessions" }).querySelector("svg");
    const mapIcon = screen.getByRole("link", { name: "Map for Academy Cinemas" }).querySelector("svg");
    expect(ticketIcon).toHaveAttribute("width", "20");
    expect(ticketIcon).toHaveAttribute("height", "20");
    expect(mapIcon).toHaveAttribute("width", "20");
    expect(mapIcon).toHaveAttribute("height", "20");
  });
});
