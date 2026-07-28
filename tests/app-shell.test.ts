import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Next.js application shell", () => {
  it("provides an Auckland-first home page", () => {
    const pagePath = resolve(projectRoot, "app/page.tsx");

    expect(existsSync(pagePath)).toBe(true);

    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain("Auckland events, before you miss them");
    expect(source).toContain('href="/events"');
  });

  it("keeps the Ticketmaster key out of browser-facing files", () => {
    const envExample = readFileSync(resolve(projectRoot, ".env.example"), "utf8");

    expect(envExample).toBe("TICKETMASTER_API_KEY=\n");
    expect(envExample).not.toContain("NEXT_PUBLIC_");
  });
});
