import { describe, expect, it } from "vitest";
import { conversePrompt, searchInputSchema, toModelMessages } from "../lib/ask/converse";
import { EMPTY_FILTERS } from "../lib/ask/schema";
import { ASSISTANTS } from "../lib/assistants";

describe("conversePrompt", () => {
  it("speaks as the chosen assistant, knows the date, the current search and what's on screen", () => {
    const prompt = conversePrompt({
      assistant: ASSISTANTS.sunny, today: "2026-10-01 (Thursday)",
      filters: { ...EMPTY_FILTERS, category: "music", dates: ["2026-10-03"] },
      shown: [{ kind: "event", title: "Jazz at the Wynyard", when: "Sat 3 Oct, 7 pm", venue: "Wynyard Pavilion", price: "From $25" }],
    });
    expect(prompt).toContain("You are Sunny");
    expect(prompt).toContain("Playful and a little witty");
    expect(prompt).toContain("2026-10-01 (Thursday)");
    expect(prompt).toContain('"category":"music"');
    expect(prompt).toContain("1. Jazz at the Wynyard — Sat 3 Oct, 7 pm · Wynyard Pavilion · From $25");
    expect(prompt).toMatch(/never invent/iu);
  });

  it("says when nothing has been searched or shown yet", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.fern, today: "2026-10-01 (Thursday)", filters: null, shown: [] });
    expect(prompt).toContain("No search yet.");
    expect(prompt).toContain("Nothing on screen yet.");
  });

  it.each(Object.values(ASSISTANTS))("gives $name native-language guidance without diluting evidence rules", (assistant) => {
    const prompt = conversePrompt({ assistant, today: "2026-10-01", filters: null, shown: [] });
    expect(prompt).toContain(assistant.style.zh);
    expect(prompt).toContain("中文用日常聊天的说法");
    expect(prompt).toContain("For a follow-up, answer that question first");
    expect(prompt).toContain("do not attach an obligatory follow-up question");
    expect(prompt).not.toContain("Never open two replies the same way");
    expect(prompt).toContain("never invent events, times, prices, links or details");
    expect(prompt).toContain("never say you already saved, booked");
  });

  it("handles possible voice feedback gently while preserving intentional quotations", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.iris, today: "2026-10-01", filters: null, shown: [] });
    expect(prompt).toContain("Do not accuse the visitor of copying");
    expect(prompt).toContain("Keep this tentative");
    expect(prompt).toContain("If the visitor intentionally quotes you");
  });
});

describe("toModelMessages", () => {
  it("turns the chat into model messages ending with the latest one", () => {
    expect(toModelMessages([{ role: "user", text: "music?" }, { role: "assistant", text: "Sure!" }], "this weekend")).toEqual([
      { role: "user", content: "music?" }, { role: "assistant", content: "Sure!" }, { role: "user", content: "this weekend" },
    ]);
  });
});

describe("searchInputSchema", () => {
  it("accepts a self-contained search and rejects nonsense", () => {
    const ok = { query: "live music Saturday", fresh: true, dates: ["2026-10-03"], names: [], place: null, maxPrice: 30, layout: "timeline" };
    expect(searchInputSchema.safeParse(ok).success).toBe(true);
    expect(searchInputSchema.safeParse({ ...ok, layout: "carousel" }).success).toBe(false);
    expect(searchInputSchema.safeParse({ ...ok, query: "" }).success).toBe(false);
    expect(searchInputSchema.safeParse({ ...ok, dates: ["Saturday"] }).success).toBe(false);
  });
});
