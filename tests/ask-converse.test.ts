import { describe, expect, it } from "vitest";
import { conversePrompt, lastStepSpeaks, REPLY_RESET, replyText, searchInputSchema, toModelMessages } from "../lib/ask/converse";
import { EMPTY_FILTERS } from "../lib/ask/schema";
import { PERSONAS } from "../lib/ask/personas";
import { ASSISTANTS } from "../lib/assistants";

describe("conversePrompt", () => {
  it("speaks as the chosen assistant, knows the date, the current search and what's on screen", () => {
    const prompt = conversePrompt({
      assistant: ASSISTANTS.sunny, today: "2026-10-01 (Thursday)",
      filters: { ...EMPTY_FILTERS, category: "music", dates: ["2026-10-03"] },
      shown: [{ kind: "event", title: "Jazz at the Wynyard", when: "Sat 3 Oct, 7 pm", venue: "Wynyard Pavilion", price: "From $25" }],
      replyLanguage: "en",
    });
    expect(prompt).toContain("You are Sunny");
    expect(prompt).toContain("Playful and a little witty");
    expect(prompt).toContain("2026-10-01 (Thursday)");
    expect(prompt).toContain('"category":"music"');
    expect(prompt).toContain("1. Jazz at the Wynyard — Sat 3 Oct, 7 pm · Wynyard Pavilion · From $25");
    expect(prompt).toMatch(/never invent/iu);
    expect(prompt).toContain("[[happy]] [[excited]] [[curious]] [[sorry]] [[surprised]] [[calm]]");
  });

  it("says when nothing has been searched or shown yet", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.fern, today: "2026-10-01 (Thursday)", filters: null, shown: [], replyLanguage: "en" });
    expect(prompt).toContain("No search yet.");
    expect(prompt).toContain("Nothing on screen yet.");
  });

  it.each(Object.values(ASSISTANTS))("gives $name a full persona in the reply language without diluting evidence rules", (assistant) => {
    const zh = conversePrompt({ assistant, today: "2026-10-01", filters: null, shown: [], replyLanguage: "zh" });
    expect(zh).toContain(assistant.style.zh);
    for (const line of PERSONAS[assistant.id].zh) expect(zh).toContain(line);
    expect(zh).toContain("reply in Chinese");
    const prompt = conversePrompt({ assistant, today: "2026-10-01", filters: null, shown: [], replyLanguage: "en" });
    for (const line of PERSONAS[assistant.id].en) expect(prompt).toContain(line);
    // Chinese persona text in an English chat pulls replies into Chinese.
    expect(prompt).not.toContain(assistant.style.zh);
    expect(prompt).toContain("reply in ENGLISH ONLY");
    expect(prompt).toContain("never invent events, times, prices, links or details");
    expect(prompt).toContain("never say you already saved, booked");
    expect(prompt).toContain("Never pretend you have been somewhere");
    expect(prompt).toContain("Don't re-ask anything the visitor already told you");
  });

  it("asks for an opinion instead of a read-out of the cards", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.fern, today: "2026-10-01", filters: null, shown: [], replyLanguage: "en" });
    expect(prompt).toContain("NEVER walk through the list");
    expect(prompt).toContain("NEVER as a menu");
    expect(prompt).toContain("First react to what they actually said");
    expect(prompt).toContain("Most replies end without a question");
    expect(prompt).toContain("Money comes up only when they mention price");
    expect(prompt).toContain("VARIETY");
    expect(prompt).toContain("search again with what you already know");
    expect(prompt).toContain("Call search without writing anything first");
    expect(prompt).toContain("# Examples (style only — never reuse their facts)");
    // Sections come in a fixed order, with the live context last.
    const order = ["# Role & Objective", "# Language", "# Personality & Tone", "# How to talk", "# Facts and limits", "# Tools", "# Examples", "# Mood", "# Context"];
    expect(order.map((heading) => prompt.indexOf(heading))).toEqual([...order.map((heading) => prompt.indexOf(heading))].sort((a, b) => a - b));
  });

  it("writes Chinese guidance and examples in Chinese for a Chinese chat", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.fern, today: "2026-10-01", filters: null, shown: [], replyLanguage: "zh" });
    expect(prompt).toContain("像微信上跟朋友聊天那样回");
    expect(prompt).toContain("你：确实，演出票不便宜。");
    expect(prompt).not.toContain("Talk like a friend texting back");
    expect(prompt).not.toContain("Visitor: hey, bored tonight");
  });

  it("handles possible voice feedback gently while preserving intentional quotations", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.iris, today: "2026-10-01", filters: null, shown: [], replyLanguage: "en" });
    expect(prompt).toContain("the mic may have caught your own voice");
    expect(prompt).toContain("Don't blame them");
    expect(prompt).toContain("If the visitor intentionally quotes you");
  });

  it("keeps friendly practical advice grounded in source evidence", () => {
    const prompt = conversePrompt({ assistant: ASSISTANTS.fern, today: "2026-10-01", filters: null, shown: [], replyLanguage: "en" });
    expect(prompt).toContain("payment methods, reservations, accessibility, ticket types or age suitability require listing evidence".replace("payment", "Payment"));
    expect(prompt).toContain("do not invent a friendly tip");
    expect(prompt).toContain("Budgets are for the whole party");
  });
});

describe("lastStepSpeaks", () => {
  it("lets the model search in early steps but makes the last one a reply", () => {
    expect(lastStepSpeaks({ stepNumber: 0 })).toBeUndefined();
    expect(lastStepSpeaks({ stepNumber: 1 })).toBeUndefined();
    expect(lastStepSpeaks({ stepNumber: 2 })).toEqual({ toolChoice: "none" });
  });
});

describe("replyText", () => {
  async function collect(parts: Array<{ type: string; text?: string }>) {
    async function* stream() { yield* parts; }
    let text = "";
    for await (const delta of replyText(stream())) text += delta;
    return text;
  }

  it("withdraws what was said before a search, so the answer isn't repeated", async () => {
    expect(await collect([
      { type: "start-step" }, { type: "text-delta", text: "Let me look." }, { type: "tool-call" }, { type: "finish-step" },
      { type: "start-step" }, { type: "text-delta", text: "Wonderverse " }, { type: "text-delta", text: "is lovely." },
    ])).toBe(`Let me look.${REPLY_RESET}Wonderverse is lovely.`);
  });

  it("leaves a reply that searched first, or never searched, as it is", async () => {
    expect(await collect([{ type: "tool-call" }, { type: "text-delta", text: "Wonderverse." }])).toBe("Wonderverse.");
    expect(await collect([{ type: "text-delta", text: "Enjoy!" }, { type: "reasoning-delta", text: "x" }])).toBe("Enjoy!");
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
