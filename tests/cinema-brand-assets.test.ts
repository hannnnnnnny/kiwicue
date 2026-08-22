import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  "academy.png",
  "event.png",
  "hoyts.png",
  "reading.svg",
  "bridgeway.png",
  "capitol.png",
  "lido.png",
  "rialto.png",
];

describe("cinema brand assets", () => {
  it.each(assets)("ships a non-empty local %s asset", (name) => {
    const path = resolve(process.cwd(), "public", "cinemas", name);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(100);
  });

  it("records official sources for every copied asset", () => {
    const manifest = readFileSync(resolve(process.cwd(), "public/cinemas/SOURCES.md"), "utf8");
    for (const name of assets) expect(manifest).toContain(`\`${name}\``);
  });
});
