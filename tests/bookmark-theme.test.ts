import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");

describe("bookmark visual and app-shell contract", () => {
  it("installs the bookmark store inside the language provider", () => {
    expect(layout).toContain("<LanguageProvider>");
    expect(layout).toContain("<BookmarkProvider>{children}</BookmarkProvider>");
  });

  it("keeps every bookmark destination and action touchable", () => {
    expect(css).toMatch(/\.saved-link\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.bookmark-button-card\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.bookmark-button-detail\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.saved-toolbar button\s*\{[^}]*min-height:\s*44px/s);
  });

  it("uses a 4/2/1 saved grid without hiding the visible save label", () => {
    expect(css).toMatch(/\.event-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
    expect(css).toMatch(/@media \(max-width:\s*1080px\)[\s\S]*\.saved-event-grid\s*\{[^}]*repeat\(2,/s);
    expect(css).toMatch(/@media \(max-width:\s*700px\)[\s\S]*\.saved-event-grid:has\(> li:only-child\)\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-width:\s*359px\)[\s\S]*\.saved-event-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(css).toMatch(/@media \(max-width:\s*359px\)[\s\S]*\.portal-brand-copy\s*\{[^}]*display:\s*none/s);
    expect(css).not.toMatch(/bookmark-button[^}]*span[^}]*display:\s*none/s);
  });
});
