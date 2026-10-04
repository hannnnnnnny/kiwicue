import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LanguageProvider } from "../components/language-provider";
import { MineTabs } from "../components/mine-tabs";

afterEach(cleanup);

it("puts Saved, Plans and Collections side by side and marks the current one", () => {
  render(<LanguageProvider><MineTabs current="plans" /></LanguageProvider>);
  const tabs = within(screen.getByRole("navigation", { name: "Mine" }));
  expect(tabs.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/saved", "/plans", "/collections"]);
  expect(tabs.getByRole("link", { name: "Plans" })).toHaveAttribute("aria-current", "page");
  expect(tabs.getByRole("link", { name: "Saved" })).not.toHaveAttribute("aria-current");
});
