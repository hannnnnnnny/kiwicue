import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readApplicationCss } from "./css-source";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const tokens = {
  "portal-bg": "#f4f6f2",
  "portal-surface": "#e8eee7",
  "portal-raised": "#fcfdf9",
  "portal-ink": "#172b26",
  "portal-muted": "#52665c",
  "portal-line": "#c6d2c8",
  "portal-brand": "#174f40",
  "portal-brand-hover": "#10392e",
  "portal-focus": "#b2412c",
  "portal-danger": "#b3261e",
} as const;

describe("KiwiCue portal theme", () => {
  it("defines exact portal tokens in the application design system", () => {
    const css = readApplicationCss().toLowerCase();
    for (const [name, value] of Object.entries(tokens)) {
      expect(css).toContain(`--${name}: ${value}`);
    }
  });

  it("removes the former presentation language", () => {
    const source = [readApplicationCss(), read("styles.css"), read("index.html")].join("\n");
    expect(source).not.toMatch(
      /--acid|--orange|#d8ff57|#e4ff83|211\s*,\s*255\s*,\s*63|radial-gradient|repeating-linear-gradient/i,
    );
  });

  it("uses Apple system typography with a bundled Inter fallback", () => {
    expect(read("package.json")).toContain('"@fontsource-variable/inter"');
    expect(read("package.json")).not.toContain('"@fontsource-variable/manrope"');
    expect(read("app/layout.tsx")).toContain('import "@fontsource-variable/inter"');
    expect(read("app/layout.tsx")).not.toContain('import "@fontsource-variable/manrope"');
    const css = readApplicationCss();
    expect(css).toContain(
      '--portal-display-font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable"',
    );
    expect(css).toContain(
      '--portal-ui-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter Variable"',
    );
    expect(css).toContain("-webkit-font-smoothing: antialiased");
    expect(css).toMatch(/\.editorial-display\s*\{[^}]*font-family:\s*var\(--portal-display-font\)/s);
  });

  it("preserves interaction and accessibility contracts", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/:focus-visible[^}]*outline:[^;}]*var\(--portal-focus\)/s);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none/s,
    );
  });

  it("contains long bilingual copy and header actions on narrow screens", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/\.portal-event-body h2\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/\.event-detail-heading h1\s*\{[^}]*overflow-wrap:\s*anywhere/s);
    expect(css).toMatch(/@media \(max-width:\s*375px\)[\s\S]*\.portal-header-link/s);
  });
});
