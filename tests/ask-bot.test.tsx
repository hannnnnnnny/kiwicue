import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AskBot } from "../components/ask/ask-bot";

afterEach(cleanup);

describe("AskBot", () => {
  it.each(["idle", "listening", "thinking", "speaking"] as const)("shows the %s state", (state) => {
    const { container } = render(<AskBot state={state} />);
    const bot = container.querySelector(".ask-bot");
    expect(bot).toHaveAttribute("data-state", state);
    expect(bot).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".ask-bot-eye")).toHaveLength(2);
    expect(container.querySelector(".ask-bot-mouth")).toBeInTheDocument();
  });

  it("comes in a small size for the launcher", () => {
    const { container } = render(<AskBot state="idle" size="small" />);
    expect(container.querySelector(".ask-bot")).toHaveAttribute("data-size", "small");
  });
});
