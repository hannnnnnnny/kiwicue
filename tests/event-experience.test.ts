import { describe, expect, it } from "vitest";
import { getEventExperience } from "../lib/event-experience";
import type { KiwiCueEvent } from "../lib/events";

function event(overrides: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return {
    id: "event-1",
    name: "Auckland event",
    url: "https://example.com/event",
    imageUrl: null,
    start: {
      localDate: "2026-09-04",
      localTime: "19:00:00",
      dateTime: "2026-09-04T07:00:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
    ...overrides,
  };
}

describe("source-backed event experience guides", () => {
  it("binds the Hiatus guide to exact Auckland event IDs and keeps the song excerpt bounded", () => {
    const guide = getEventExperience(event({ id: "1Ae8Z_oGkwOKdBs", name: "Hiatus Kaiyote" }));
    expect(guide?.sections.map((section) => section.kind)).toEqual([
      "official", "historical-report", "historical-report", "official",
    ]);
    const reference = guide?.sections.find((section) => section.kind === "historical-report");
    expect(reference?.songs).toEqual(["Rose Water", "Rainbow Rhodes", "Dilla (Nag Champa)"]);
    expect(reference?.caveat).toContain("not the Auckland running order");
    expect(reference?.links?.[0]?.url).toContain("scenestr.com.au");
  });

  it("provides only an official first-visit guide for a generic curated market", () => {
    const guide = getEventExperience(event({
      id: "kc-market-night-botany",
      name: "Auckland Night Market — Botany",
      category: "Market",
      source: { name: "Auckland Night Markets", url: "https://www.aucklandnightmarkets.co.nz/locations", verifiedAt: "2026-08-12", provenance: "recurring-schedule" },
      editorialPreview: { summary: "Street food and sweet treats.", highlights: ["Food stalls", "Evening browse"] },
      localization: { zh: { previewSummary: "街头美食和甜点。", previewHighlights: ["美食摊位", "夜间逛逛"] } },
    }));
    expect(guide?.sections).toHaveLength(1);
    expect(guide?.sections[0]?.heading).toBe("First-visit guide");
    expect(guide?.sections[0]?.kind).toBe("first-visit");
  });

  it("adds Grey Lynn's dated organiser notice without calling it an attendance report", () => {
    const guide = getEventExperience(event({
      id: "kc-market-grey-lynn",
      category: "Market",
      source: { name: "Grey Lynn Farmers Market", url: "https://www.greylynnfarmersmarket.co.nz/", verifiedAt: "2026-08-12", provenance: "recurring-schedule" },
      editorialPreview: { summary: "Local growers and food makers.", highlights: ["Produce", "Food makers"] },
    }));
    const notice = guide?.sections.find((section) => section.kind === "historical-organizer");
    expect(notice?.heading).toBe("Previous organiser notice · 30 Aug 2026");
    expect(notice?.caveat).toContain("not an attendance report");
  });

  it("does not create a guide from a loose title or unsafe source", () => {
    expect(getEventExperience(event({ name: "Hiatus Kaiyote" }))).toBeNull();
    expect(getEventExperience(event({
      id: "kc-market-custom",
      category: "Market",
      source: { name: "Untrusted", url: "javascript:alert(1)", verifiedAt: "2026-08-12" },
      editorialPreview: { summary: "A guide", highlights: ["One point"] },
    }))).toBeNull();
  });
});
