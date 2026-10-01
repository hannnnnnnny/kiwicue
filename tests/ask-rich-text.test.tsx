import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { plainText, RichText } from "../components/ask/rich-text";

afterEach(cleanup);

describe("RichText", () => {
  it("renders paragraphs, bullet and numbered lists, and bold", () => {
    const { container } = render(<RichText text={"Two good ones:\n\n- **Jazz Night** at 7 pm\n- **Indie Fest**, free\n\n1. First\n2. Second\nEnjoy!"} />);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("ul")?.children).toHaveLength(2);
    expect(container.querySelector("ol")?.children).toHaveLength(2);
    expect(container.querySelector("ul strong")).toHaveTextContent("Jazz Night");
  });

  it("never renders markup from the text", () => {
    const { container } = render(<RichText text={'<img src=x onerror="alert(1)"> **<b>hi</b>**'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)"> <b>hi</b>');
  });

  it("copes with half-streamed bold", () => {
    const { container } = render(<RichText text="Try **Jazz" />);
    expect(container).toHaveTextContent("Try **Jazz");
  });
});

describe("plainText", () => {
  it("strips formatting for speech", () => {
    expect(plainText("Two:\n- **Jazz Night** at 7\n1. Indie")).toBe("Two: Jazz Night at 7. Indie.");
  });
});
