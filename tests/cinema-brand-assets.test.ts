import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assets = [
  {
    name: "academy.png",
    officialPage: "https://www.academycinemas.co.nz/",
    source: "https://cdn.vwassets.com/academycinemas.co.nz/1491085808806_academylogo.png",
  },
  {
    name: "event.png",
    officialPage: "https://www.eventcinemas.co.nz/",
    source: "https://cdn.eventcinemas.co.nz/cdn/content/img/icons/apple-icon-180x180.png",
  },
  {
    name: "hoyts.png",
    officialPage: "https://www.hoyts.co.nz/",
    source: "https://www.hoyts.co.nz/apple-touch-icon.png",
  },
  {
    name: "reading.svg",
    officialPage: "https://www.readingcinemas.co.nz/",
    source: "https://d2apwscfoijj3f.cloudfront.net/assets/images/reading-cinemas-logo-white.svg",
  },
  {
    name: "bridgeway.png",
    officialPage: "https://www.bridgeway.co.nz/",
    source: "https://cdn.vwassets.com/bridgeway.co.nz/1691382267615_bridgewaylogo.png",
  },
  {
    name: "capitol.png",
    officialPage: "https://www.thecapitol.co.nz/",
    source: "https://cdn.vwassets.com/thecapitol.co.nz/1557886440149_capitollogo.png",
  },
  {
    name: "lido.png",
    officialPage: "https://www.lido.co.nz/",
    source: "https://www.lido.co.nz/apple-touch-icon.png",
  },
  {
    name: "rialto.png",
    officialPage: "https://www.rialto.co.nz/",
    source: "https://cdn.rialto.co.nz/cdn/content/img/icons/apple-icon-180x180.png",
  },
];

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const maxAssetBytes = 1024 * 1024;

describe("cinema brand assets", () => {
  it.each(assets)("ships a valid local $name asset", ({ name }) => {
    const path = resolve(process.cwd(), "public", "cinemas", name);
    expect(existsSync(path)).toBe(true);
    const bytes = readFileSync(path);
    expect(statSync(path).size).toBeGreaterThan(100);
    expect(bytes.byteLength).toBeLessThanOrEqual(maxAssetBytes);
    if (name.endsWith(".png")) {
      expect(bytes.subarray(0, pngSignature.length)).toEqual(pngSignature);
    } else {
      const svg = bytes.toString("utf8");
      expect(svg.trimStart().startsWith("<svg")).toBe(true);
      expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/<script\b|\bon\w+\s*=|(?:xlink:)?href\s*=\s*["']https?:/i);
    }
  });

  it("records exact official sources and usage metadata for every asset", () => {
    const manifest = readFileSync(resolve(process.cwd(), "public/cinemas/SOURCES.md"), "utf8");
    for (const { name, officialPage, source } of assets) {
      expect(manifest).toContain(`| \`${name}\` | ${officialPage} | ${source} | 2026-08-23 | Identification only |`);
    }
  });
});
