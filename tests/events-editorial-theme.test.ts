import { describe, expect, it } from "vitest";
import { readApplicationCss } from "./css-source";

describe("events editorial visual system", () => {
  it("uses an asymmetric lead grid and removes boxed event borders", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/\.event-lead-story\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(18rem,\s*1fr\)/s);
    expect(css).toMatch(/\.portal-event-card\s*{[^}]*border:\s*0/s);
    expect(css).toMatch(/\.events-page \.event-category-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    expect(css).toMatch(/\.events-page \.event-category-card\s*{[^}]*border:\s*0/s);
    expect(css).toMatch(/\.event-collection-list\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  });

  it("recomposes discovery at 639px and honours reduced motion", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/@media\s*\(max-width:\s*639px\)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/\.event-mood-links a[^{]*{[^}]*min-height:\s*44px/s);
  });
});
