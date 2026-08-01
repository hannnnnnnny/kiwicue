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

  it("keeps the Ticketmaster key out of browser-facing files", () => {
    const envExample = readFileSync(resolve(projectRoot, ".env.example"), "utf8");

    expect(envExample.trimEnd()).toBe("TICKETMASTER_API_KEY=");
    expect(envExample).not.toContain("NEXT_PUBLIC_");
  });
});
