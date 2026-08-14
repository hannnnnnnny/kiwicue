import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readApplicationCss } from "./css-source";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const tokens = {
  "portal-bg": "#f5f5f7",
  "portal-surface": "#fbfbfd",
  "portal-raised": "#ffffff",
  "portal-ink": "#1d1d1f",
  "portal-muted": "#6e6e73",
  "portal-line": "#d2d2d7",
  "portal-brand": "#146c5b",
  "portal-brand-hover": "#0d5144",
  "portal-focus": "#0071e3",
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

  it("bundles Manrope and exposes interaction and accessibility contracts", () => {
    expect(read("package.json")).toContain('"@fontsource-variable/manrope"');
    expect(read("app/layout.tsx")).toContain('import "@fontsource-variable/manrope"');
    const css = readApplicationCss();
    expect(css).toContain("--portal-display-font:");
    expect(css).toContain("--portal-ui-font:");
    expect(css).toMatch(/\.editorial-display\s*\{[^}]*font-family:\s*var\(--portal-display-font\)/s);
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
