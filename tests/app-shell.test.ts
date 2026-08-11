import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Next.js application shell", () => {
  it("redirects the root to the Auckland event portal", () => {
    const pagePath = resolve(projectRoot, "app/page.tsx");

    expect(existsSync(pagePath)).toBe(true);

    const pageSource = readFileSync(pagePath, "utf8");
    expect(pageSource).toContain('permanentRedirect("/events")');
    expect(pageSource).not.toContain("HomeContent");
  });

  it("documents server-only API credentials without public prefixes", () => {
    const envExample = readFileSync(resolve(projectRoot, ".env.example"), "utf8");

    expect(envExample.trimEnd().split(/\r?\n/)).toEqual([
      "TICKETMASTER_API_KEY=",
      "TMDB_READ_ACCESS_TOKEN=",
    ]);
    expect(envExample).not.toContain("NEXT_PUBLIC_");
  });
});
