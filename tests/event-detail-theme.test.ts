import { describe, expect, it } from "vitest";
import { readApplicationCss } from "./css-source";

const css = readApplicationCss();

describe("event detail visual contract", () => {
  it("uses a readable editorial desktop layout with a sticky venue panel", () => {
    expect(css).toMatch(/\.event-detail-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.45fr\)\s+minmax\(320px,\s*\.55fr\)/s);
    expect(css).toMatch(/\.event-detail-venue\s*\{[^}]*position:\s*sticky/s);
    expect(css).toMatch(/\.event-detail-media\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s);
    expect(css).toMatch(/\.event-map iframe\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/s);
  });

  it("keeps all new actions touchable and focus-visible", () => {
    for (const selector of [
      ".event-detail-back",
      ".event-map figcaption a",
      ".distance-panel button",
      ".event-booking-action",
      ".event-booking-inline",
    ]) {
      expect(css).toMatch(new RegExp(`${selector.replaceAll(".", "\\.")}[^}]*min-height:\\s*(?:44px|52px|56px)`, "s"));
    }
    expect(css).toMatch(/:focus-visible[^}]*outline:[^;}]*var\(--portal-focus\)/s);
  });

  it("becomes one column at 900px and disables sticky positioning on short viewports", () => {
    expect(css).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.event-detail-shell\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-height:\s*760px\)[\s\S]*\.event-detail-venue\s*\{[^}]*position:\s*static/s);
    expect(css).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/s);
  });
});
