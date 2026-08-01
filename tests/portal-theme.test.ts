import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const tokens = {
  "portal-bg": "#ffffff",
  "portal-surface": "#f5f7f6",
  "portal-raised": "#ffffff",
  "portal-ink": "#17211d",
  "portal-muted": "#66736d",
  "portal-line": "#dce3df",
  "portal-brand": "#126b4b",
  "portal-brand-hover": "#0d583e",
  "portal-focus": "#0b57d0",
  "portal-danger": "#b42318",
} as const;

describe("KiwiCue portal theme", () => {
  it.each(["app/globals.css", "styles.css"])("defines exact portal tokens in %s", (path) => {
    const css = read(path).toLowerCase();
    for (const [name, value] of Object.entries(tokens)) {
      expect(css).toContain(`--${name}: ${value}`);
    }
  });

  it("removes the former presentation language", () => {
    const source = [read("app/globals.css"), read("styles.css"), read("index.html")].join("\n");
    expect(source).not.toMatch(
      /--acid|--orange|#d8ff57|#e4ff83|211\s*,\s*255\s*,\s*63|radial-gradient|repeating-linear-gradient/i,
    );
  });

  it("bundles Manrope and exposes interaction and accessibility contracts", () => {
    expect(read("package.json")).toContain('"@fontsource-variable/manrope"');
    expect(read("app/layout.tsx")).toContain('import "@fontsource-variable/manrope"');
    const css = read("app/globals.css");
    expect(css).toMatch(/:focus-visible[^}]*outline:[^;}]*var\(--portal-focus\)/s);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none/s,
    );
  });

  it("contains long portal copy and header actions on narrow screens", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/\.hero-copy,\s*\.events-masthead-copy\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(
      /\.events-scope strong\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/s,
    );
    expect(css).toMatch(
      /@media \(max-width:\s*620px\)[\s\S]*\.home-return\s*\{[^}]*display:\s*none/s,
    );
  });
});
