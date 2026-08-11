import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventImage } from "../components/event-image";

afterEach(cleanup);

describe("resilient event image", () => {
  it("replaces a failed remote image with the local event fallback", () => {
    const view = render(
      <EventImage src="https://images.example/event.jpg" alt="" fallback="AKL" />,
    );

    const image = view.container.querySelector("img");
    expect(image).toHaveAttribute("src", "https://images.example/event.jpg");
    fireEvent.error(image!);

    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("AKL")).toBeVisible();
  });

  it("renders the same fallback when no image URL exists", () => {
    render(<EventImage src={null} alt="" fallback="AKL" />);

    expect(screen.getByText("AKL")).toBeVisible();
  });
});
