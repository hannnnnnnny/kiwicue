import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskLauncher } from "../components/ask/ask-launcher";
import { LanguageProvider } from "../components/language-provider";

const navigation = vi.hoisted(() => ({ pathname: "/events" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

afterEach(() => { cleanup(); navigation.pathname = "/events"; });

function launcher(enabled = true) {
  return <LanguageProvider><AskLauncher enabled={enabled} /></LanguageProvider>;
}

describe("AskLauncher", () => {
  it("renders nothing until the service is configured", () => {
    render(launcher(false));
    expect(screen.queryByRole("button", { name: "Ask KiwiCue" })).not.toBeInTheDocument();
  });

  it("opens and closes the overlay and returns focus to the button", () => {
    render(launcher());
    const button = screen.getByRole("button", { name: "Ask KiwiCue" });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Fern" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("gets out of the way when a link inside it navigates to another page", () => {
    const view = render(launcher());
    fireEvent.click(screen.getByRole("button", { name: "Ask KiwiCue" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    navigation.pathname = "/login";
    view.rerender(launcher());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
