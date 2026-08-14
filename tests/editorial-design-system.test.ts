import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const stylesDirectory = resolve(root, "app/styles");
const globals = readFileSync(resolve(root, "app/globals.css"), "utf8");

function applicationCss() {
  if (!existsSync(stylesDirectory)) return globals;
  return [
    globals,
    ...readdirSync(stylesDirectory)
      .filter((file) => file.endsWith(".css"))
      .sort()
      .map((file) => readFileSync(resolve(stylesDirectory, file), "utf8")),
  ].join("\n");
}

describe("editorial information hub design system", () => {
  it("splits bounded style concerns behind one global entry point", () => {
    expect(existsSync(stylesDirectory)).toBe(true);
    for (const file of ["tokens.css", "base.css", "shell.css", "events.css", "detail-saved.css", "movies.css", "responsive.css"]) {
      expect(globals).toContain(`@import "./styles/${file}";`);
    }
  });

  it("gives the movie hub tokenized panels, controls, and touch targets", () => {
    const moviesPath = resolve(stylesDirectory, "movies.css");
    expect(existsSync(moviesPath)).toBe(true);
    const css = existsSync(moviesPath) ? readFileSync(moviesPath, "utf8") : "";
    expect(css).toContain("border-radius: var(--radius-control)");
    expect(css).toContain("border-radius: var(--radius-panel)");
    expect(css).toMatch(/min-height:\s*(?:44|48|52)px/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("defines an Apple-clean neutral palette with one KiwiCue fern accent", () => {
    const css = applicationCss().toLowerCase();
    for (const token of [
      "--portal-bg: #f5f5f7",
      "--portal-surface: #fbfbfd",
      "--portal-raised: #ffffff",
      "--portal-ink: #1d1d1f",
      "--portal-muted: #6e6e73",
      "--portal-line: #d2d2d7",
      "--portal-brand: #146c5b",
      "--portal-accent: #146c5b",
      "--portal-display-font:",
      "--portal-ui-font:",
      "--radius-control: 8px",
      "--radius-panel: 12px",
      "--radius-pill: 999px",
      "--container: 1320px",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("uses only the approved radius tokens and dynamic viewport height", () => {
    const css = applicationCss();
    const radiusDeclarations = [...css.matchAll(/border-radius:\s*([^;}]+)/g)]
      .map((match) => match[1].trim());

    expect(radiusDeclarations.length).toBeGreaterThan(10);
    for (const value of radiusDeclarations) {
      expect(["0", "var(--radius-control)", "var(--radius-panel)", "var(--radius-pill)"])
        .toContain(value);
    }
    expect(css).toMatch(/main\s*\{[^}]*min-height:\s*100dvh/s);
  });

  it("validates the requested browser widths in Playwright", () => {
    const config = readFileSync(resolve(root, "playwright.config.ts"), "utf8");
    for (const width of [375, 768, 1440]) {
      expect(config).toMatch(new RegExp(`width:\\s*${width}`));
    }
  });
});
