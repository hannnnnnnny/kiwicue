import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BackLink, cameFromKiwiCue, NavigationTracker } from "../components/back-link";

const location = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => location.pathname }));
const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);

beforeEach(() => { sessionStorage.clear(); back.mockClear(); location.pathname = "/"; window.history.pushState(null, "", "/"); });
afterEach(cleanup);

describe("NavigationTracker", () => {
  it("remembers moving between KiwiCue pages in this tab", () => {
    const { rerender } = render(<NavigationTracker />);
    expect(cameFromKiwiCue()).toBe(false);
    location.pathname = "/events/abc";
    rerender(<NavigationTracker />);
    expect(cameFromKiwiCue()).toBe(true);
  });

  it("starts fresh when a page is opened from another site", () => {
    sessionStorage.setItem("kiwicue:in-app", "1");
    const referrer = vi.spyOn(document, "referrer", "get").mockReturnValue("https://www.google.com/");
    render(<NavigationTracker />);
    expect(cameFromKiwiCue()).toBe(false);
    referrer.mockRestore();
  });
});

describe("BackLink", () => {
  it("goes back through history when the visitor came from a KiwiCue page", () => {
    sessionStorage.setItem("kiwicue:in-app", "1");
    render(<BackLink fallback="/events">← Back</BackLink>);
    const link = screen.getByRole("link", { name: "← Back" });
    expect(link).toHaveAttribute("href", "/events");
    expect(fireEvent.click(link)).toBe(false);
    expect(back).toHaveBeenCalledOnce();
  });

  it("follows its fallback link otherwise, or when opened in a new tab", () => {
    render(<BackLink fallback="/events">← Back</BackLink>);
    expect(fireEvent.click(screen.getByRole("link"))).toBe(true);
    sessionStorage.setItem("kiwicue:in-app", "1");
    expect(fireEvent.click(screen.getByRole("link"), { metaKey: true })).toBe(true);
    expect(back).not.toHaveBeenCalled();
  });
});
