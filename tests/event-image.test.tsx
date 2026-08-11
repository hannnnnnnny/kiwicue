import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventImage } from "../components/event-image";

afterEach(cleanup);

describe("resilient event image", () => {
  it("replaces a failed remote image with useful accessible fallback content", () => {
    const view = render(
      <EventImage
        src="https://images.example/event.jpg"
        alt=""
        fallback="What to expect at this market"
      />,
    );

    const image = view.container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://images.example/event.jpg");
    fireEvent.error(image!);

    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("What to expect at this market")).toBeVisible();
    expect(screen.getByText("What to expect at this market")).not.toHaveAttribute(
      "aria-hidden",
    );
  });

  it("renders useful fallback content when no image URL exists", () => {
    render(<EventImage src={null} alt="" fallback="Market preview" />);

    expect(screen.getByText("Market preview")).toBeVisible();
  });
});
