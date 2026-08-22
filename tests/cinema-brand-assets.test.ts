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
    name: "event.svg",
    officialPage: "https://www.eventcinemas.co.nz/",
    source: "https://cdn.eventcinemas.co.nz/cdn/content/img/ec-logo.svg?v=cTZXIQfpyXJAdDbg56KIoNgM9Ps",
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
    source: "https://cdn.rialto.co.nz/cdn/content/img/rialto-logo_white-on-trans-horiz.png?v=8WShZUuhdVSVLQMqdUD98EyDiDI",
  },
];

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const maxAssetBytes = 1024 * 1024;

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parsePngAsset(bytes: Buffer): boolean {
  if (bytes.subarray(0, pngSignature.length).compare(pngSignature) !== 0) return false;
  let offset = pngSignature.length;
  let hasHeader = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return false;
    const length = bytes.readUInt32BE(offset);
    const dataStart = offset + 8;
    const crcStart = dataStart + length;
    if (crcStart + 4 > bytes.length) return false;
    const type = bytes.subarray(offset + 4, dataStart).toString("ascii");
    const expectedCrc = bytes.readUInt32BE(crcStart);
    if (crc32(bytes.subarray(offset + 4, crcStart)) !== expectedCrc) return false;
    if (!hasHeader && (type !== "IHDR" || length !== 13)) return false;
    hasHeader ||= type === "IHDR";
    offset = crcStart + 4;
    if (type === "IEND") return length === 0 && hasHeader && offset === bytes.length;
  }
  return false;
}

function parseSafeSvg(svg: string): boolean {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName !== "svg") return false;
  for (const element of Array.from(parsed.querySelectorAll("*"))) {
    if (element.localName.toLowerCase() === "script") return false;
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) return false;
      if (/^(?:https?:|\/\/|data:|blob:)/i.test(attribute.value) && /(?:^|:)href$/i.test(attribute.name)) {
        return false;
      }
    }
  }
  return true;
}

it("rejects malformed PNG chunks and unsafe SVG XML", () => {
  const malformedPng = Buffer.concat([pngSignature, Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44])]);
  const badCrcHeader = Buffer.alloc(25);
  badCrcHeader.writeUInt32BE(13, 0);
  badCrcHeader.write("IHDR", 4, "ascii");
  expect(parsePngAsset(malformedPng)).toBe(false);
  expect(parsePngAsset(Buffer.concat([pngSignature, badCrcHeader]))).toBe(false);
  expect(parseSafeSvg('<svg><script>alert(1)</script></svg>')).toBe(false);
  expect(parseSafeSvg('<svg><use href="https://evil.example/x.svg#mark" /></svg>')).toBe(false);
  expect(parseSafeSvg('<svg><path d="M0 0" /></svg>')).toBe(true);
});

describe("cinema brand assets", () => {
  it.each(assets)("ships a valid local $name asset", ({ name }) => {
    const path = resolve(process.cwd(), "public", "cinemas", name);
    expect(existsSync(path)).toBe(true);
    const bytes = readFileSync(path);
    expect(statSync(path).size).toBeGreaterThan(100);
    expect(bytes.byteLength).toBeLessThanOrEqual(maxAssetBytes);
    if (name.endsWith(".png")) {
      expect(parsePngAsset(bytes)).toBe(true);
    } else {
      expect(parseSafeSvg(bytes.toString("utf8"))).toBe(true);
    }
  });

  it("records exact official sources and usage metadata for every asset", () => {
    const manifest = readFileSync(resolve(process.cwd(), "public/cinemas/SOURCES.md"), "utf8");
    for (const { name, officialPage, source } of assets) {
      expect(manifest).toContain(`| \`${name}\` | ${officialPage} | ${source} | 2026-08-23 | Identification only |`);
    }
  });

  it("keeps EVENT and Rialto's locally stored official marks distinct", () => {
    const event = readFileSync(resolve(process.cwd(), "public/cinemas/event.svg"));
    const rialto = readFileSync(resolve(process.cwd(), "public/cinemas/rialto.png"));

    expect(event.equals(rialto)).toBe(false);
  });
});
