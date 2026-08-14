import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readApplicationCss } from "./css-source";

const root = resolve(import.meta.dirname, "..");
const css = readApplicationCss();
const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");

describe("bookmark visual and app-shell contract", () => {
  it("installs the bookmark store inside the language provider", () => {
    expect(layout).toContain("<LanguageProvider>");
    expect(layout).toContain("<BookmarkProvider>{children}</BookmarkProvider>");
  });

  it("keeps every bookmark destination and action touchable", () => {
    expect(css).toMatch(/\.saved-link\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.bookmark-button-card\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.bookmark-button-detail\s*\{[^}]*min-height:\s*52px/s);
    expect(css).toMatch(/\.saved-toolbar button\s*\{[^}]*min-height:\s*44px/s);
  });

  it("uses a 3/2/1 saved grid without hiding the visible save label", () => {
    expect(css).toMatch(/\.event-grid,[\s\S]*?grid-template-columns:\s*repeat\(3,/s);
    expect(css).toMatch(/@media \(max-width:\s*900px\)[\s\S]*?\.saved-event-grid\s*\{[^}]*repeat\(2,/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*?\.saved-event-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-width:\s*340px\)[\s\S]*\.portal-brand-copy\s*\{[^}]*display:\s*none/s);
    expect(css).not.toMatch(/bookmark-button[^}]*span[^}]*display:\s*none/s);
  });
});
