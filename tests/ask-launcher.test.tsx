import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AskLauncher } from "../components/ask/ask-launcher";
import { LanguageProvider } from "../components/language-provider";

afterEach(cleanup);

describe("AskLauncher", () => {
  it("renders nothing until the service is configured", () => {
    render(<LanguageProvider><AskLauncher enabled={false} /></LanguageProvider>);
    expect(screen.queryByRole("button", { name: "Ask KiwiCue" })).not.toBeInTheDocument();
  });

  it("opens and closes the overlay and returns focus to the button", () => {
    render(<LanguageProvider><AskLauncher enabled /></LanguageProvider>);
    const button = screen.getByRole("button", { name: "Ask KiwiCue" });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Ask KiwiCue" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
