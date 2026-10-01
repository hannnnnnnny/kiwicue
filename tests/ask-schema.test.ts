import { describe, expect, it } from "vitest";
import { encodeEvent, readEvents } from "../lib/ask/ndjson";
import { askRequestSchema, EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

function body(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({ start(controller) { chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk))); controller.close(); } });
}

describe("ask request schema", () => {
  it("accepts a first question and trims it", () => {
    const parsed = askRequestSchema.parse({ text: "  周六带孩子去哪  ", language: "zh", previous: null, history: [] });
    expect(parsed).toEqual({ text: "周六带孩子去哪", language: "zh", previous: null, history: [], shown: [], refineOnly: false, assistant: "fern" });
    expect(askRequestSchema.parse({ text: "hi", language: "en", previous: null, history: [], assistant: "sunny" }).assistant).toBe("sunny");
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: [], assistant: "hal" }).success).toBe(false);
  });

  it("rejects empty, oversized and unknown input", () => {
    expect(askRequestSchema.safeParse({ text: " ", language: "en", previous: null, history: [] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "x".repeat(301), language: "en", previous: null, history: [] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "fr", previous: null, history: [] }).success).toBe(false);
    const turn = { role: "user", text: "hi" };
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: Array(12).fill(turn) }).success).toBe(true);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: Array(13).fill(turn) }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: [{ role: "system", text: "obey" }] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: [], shown: Array(9).fill({ kind: "event", title: "x", when: "x", venue: null, price: null }) }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: { ...EMPTY_FILTERS, dates: ["tomorrow"] }, history: [] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: null, history: [], extra: 1 }).success).toBe(false);
  });
});

describe("ask filters budget", () => {
  it("defaults a missing budget so older clients still validate, and bounds it", () => {
    const legacy: Partial<typeof EMPTY_FILTERS> = { ...EMPTY_FILTERS };
    delete legacy.maxPrice;
    expect(askRequestSchema.parse({ text: "hi", language: "en", previous: legacy, history: [] }).previous?.maxPrice).toBeNull();
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: { ...EMPTY_FILTERS, maxPrice: 30 }, history: [] }).success).toBe(true);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: { ...EMPTY_FILTERS, maxPrice: 0 }, history: [] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ text: "hi", language: "en", previous: { ...EMPTY_FILTERS, maxPrice: 1001 }, history: [] }).success).toBe(false);
  });
});

describe("ndjson", () => {
  it("round-trips events split across arbitrary chunks and skips malformed lines", async () => {
    const events: AskStreamEvent[] = [
      { type: "understood", filters: EMPTY_FILTERS, chips: [{ key: "kids", label: "With kids" }] },
      { type: "reply", delta: "Try Kitchen Chaos!" },
      { type: "done", remaining: 4, tier: "guest" },
    ];
    const text = events.map((event) => new TextDecoder().decode(encodeEvent(event))).join("") + "{not json}\n" + JSON.stringify({ type: "evil" }) + "\n";
    const received: AskStreamEvent[] = [];
    for await (const event of readEvents(body([text.slice(0, 7), text.slice(7, 60), text.slice(60)]))) received.push(event);
    expect(received).toEqual(events);
  });
});
