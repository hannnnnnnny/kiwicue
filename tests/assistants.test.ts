import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSISTANT_IDS, ASSISTANTS, DEFAULT_ASSISTANT, parseAssistantId, themeInitScript } from "../lib/assistants";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("assistants", () => {
  it("has five assistants with names, roles, voices and assets", () => {
    expect(ASSISTANT_IDS).toEqual(["iris", "rua", "sunny", "fern", "kai"]);
    expect(DEFAULT_ASSISTANT).toBe("fern");
    for (const id of ASSISTANT_IDS) {
      const assistant = ASSISTANTS[id];
      expect(assistant.model).toBe(`/assistants/${id}.glb`);
      expect(assistant.poster).toBe(`/assistants/${id}.webp`);
      expect(assistant.role.en).not.toBe("");
      expect(assistant.style.en.length).toBeLessThan(120);
      expect(assistant.voice.rate).toBeGreaterThan(0.8);
      expect(assistant.voice.rate).toBeLessThan(1.25);
    }
  });

  it.each(ASSISTANT_IDS)("keeps %s's brand colours readable (WCAG AA)", (id) => {
    const { colors } = ASSISTANTS[id];
    expect(contrast(colors.brand, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.hover, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.brand, colors.soft)).toBeGreaterThanOrEqual(4.5);
  });

  it("themes the site with exactly the registry's colours", () => {
    const css = readFileSync("app/styles/assistants.css", "utf8");
    for (const id of ASSISTANT_IDS) {
      const { brand, hover, soft } = ASSISTANTS[id].colors;
      const block = css.slice(css.indexOf(`[data-assistant="${id}"]`)).split("}")[0];
      expect(block).toContain(`--portal-brand: ${brand};`);
      expect(block).toContain(`--portal-brand-hover: ${hover};`);
      expect(block).toContain(`--portal-brand-soft: ${soft};`);
      expect(block).toContain(`--portal-focus: ${brand};`);
    }
    expect(readFileSync("app/globals.css", "utf8")).toContain('@import "./styles/assistants.css";');
    const layout = readFileSync("app/layout.tsx", "utf8");
    expect(layout).toContain("themeInitScript");
    expect(layout).toContain(`data-assistant={DEFAULT_ASSISTANT}`);
  });

  it("parses only known ids", () => {
    expect(parseAssistantId("sunny")).toBe("sunny");
    expect(parseAssistantId("evil")).toBeNull();
    expect(parseAssistantId(null)).toBeNull();
  });

  it("applies the saved assistant before paint and ignores anything unknown", () => {
    const run = (saved: string | null) => {
      const root = { dataset: {} as Record<string, string> };
      const storage = { getItem: () => saved };
      new Function("document", "localStorage", themeInitScript)({ documentElement: root }, storage);
      return root.dataset.assistant;
    };
    expect(run("kai")).toBe("kai");
    expect(run("<script>")).toBe("fern");
    expect(run(null)).toBe("fern");
  });
});
