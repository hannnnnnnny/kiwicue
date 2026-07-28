import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Next.js application shell", () => {
  it("provides an Auckland-first home page", () => {
    const pagePath = resolve(projectRoot, "app/page.tsx");
    const contentPath = resolve(projectRoot, "components/home-content.tsx");

    expect(existsSync(pagePath)).toBe(true);
    expect(existsSync(contentPath)).toBe(true);

    const pageSource = readFileSync(pagePath, "utf8");
    const contentSource = readFileSync(contentPath, "utf8");
    expect(pageSource).toContain("HomeContent");
    expect(contentSource).toContain("Auckland events, before you miss them");
    expect(contentSource).toContain('href="/events"');
  });

  it("keeps the Ticketmaster key out of browser-facing files", () => {
    const envExample = readFileSync(resolve(projectRoot, ".env.example"), "utf8");

    expect(envExample.trimEnd()).toBe("TICKETMASTER_API_KEY=");
    expect(envExample).not.toContain("NEXT_PUBLIC_");
  });
});
