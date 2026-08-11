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
    for (const file of ["tokens.css", "base.css", "shell.css", "events.css", "detail-saved.css", "responsive.css"]) {
      expect(globals).toContain(`@import "./styles/${file}";`);
    }
  });

  it("defines the warm editorial palette and finite layout tokens", () => {
    const css = applicationCss().toLowerCase();
    for (const token of [
      "--portal-bg: #f4f0e8",
      "--portal-surface: #fbfaf6",
      "--portal-raised: #fffefa",
      "--portal-ink: #18231e",
      "--portal-muted: #627069",
      "--portal-line: #d8ddd6",
      "--portal-brand: #1f5b45",
      "--portal-danger: #a13b32",
      "--radius-control: 8px",
      "--radius-panel: 12px",
      "--radius-pill: 999px",
      "--container: 1280px",
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
      expect(["var(--radius-control)", "var(--radius-panel)", "var(--radius-pill)"])
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
