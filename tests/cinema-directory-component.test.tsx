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
  });

  it("replaces an unavailable official mark with its initials", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    fireEvent.error(screen.getByTestId("cinema-brand-academy").querySelector("img")!);

    expect(screen.getByTestId("cinema-brand-academy")).toHaveTextContent("AC");
    expect(screen.getByTestId("cinema-brand-academy").querySelector("img")).not.toBeInTheDocument();
  });

  it("keeps accessible actions while marking decorative icons as hidden", () => {
    render(<CinemaDirectory cinemas={AUCKLAND_CINEMAS} language="en" />);

    expect(screen.getByRole("link", { name: "Academy Cinemas sessions" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Map for Academy Cinemas" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
