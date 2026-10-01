import { afterEach, describe, expect, it, vi } from "vitest";
import type { Evaluate } from "../lib/ask/jev";
import { rankCards } from "../lib/ask/rank";
import { replyDeltas, type StreamReply } from "../lib/ask/reply";
import { EMPTY_FILTERS, type AskCard } from "../lib/ask/schema";

function card(id: string, title: string, when: string): AskCard {
  return { kind: "event", id, title, when, venue: "Venue", href: `/events/${id}`, imageUrl: null, priceText: null, sessionCount: 1, score: 0 };
}
const cards = [card("a", "Rock Night", "2026-10-03T20:00:00+13:00"), card("b", "Bundle Baby", "2026-10-03T10:00:00+13:00"), card("c", "Cabaret", "2026-10-02T19:00:00+13:00")];

afterEach(() => vi.restoreAllMocks());

describe("rankCards", () => {
  it("puts named matches first, then orders by Jev score", async () => {
    const evaluate = vi.fn<Evaluate>().mockResolvedValue({ inputTokens: 900, answers: { c0: { type: "score", score: 3 }, c1: { type: "score", score: 1 } } });
    const result = await rankCards({ text: "Cabaret or something musical", filters: { ...EMPTY_FILTERS, names: ["cabaret"] }, cards, evaluate });
    expect(result.ranked.map((item) => [item.id, item.score])).toEqual([["c", 1], ["a", 1], ["b", 1 / 3]]);
    expect(result).toMatchObject({ inputTokens: 900, degraded: false });
    expect(Object.keys(evaluate.mock.calls[0][0].questions)).toEqual(["c0", "c1"]);
  });

  it("falls back to date order when Jev fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn<Evaluate>().mockRejectedValue(new Error("down"));
    const result = await rankCards({ text: "anything", filters: EMPTY_FILTERS, cards, evaluate });
    expect(result.ranked.map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(result.degraded).toBe(true);
  });
});

describe("replyDeltas", () => {
  it("streams text and returns usage", async () => {
    const stream: StreamReply = () => ({
      textStream: (async function* () { yield "Try "; yield "Cabaret."; })(),
      usage: Promise.resolve({ inputTokens: 200, outputTokens: 12 }),
    });
    const generator = replyDeltas({ text: "musicals?", language: "en", top: [cards[2]], stream });
    const deltas: string[] = [];
    let step = await generator.next();
    while (!step.done) { deltas.push(step.value); step = await generator.next(); }
    expect(deltas.join("")).toBe("Try Cabaret.");
    expect(step.value).toEqual({ inputTokens: 200, outputTokens: 12 });
  });

  it("asks for an honest 'nothing exact' sentence when filters were loosened", async () => {
    const stream = vi.fn<StreamReply>(() => ({ textStream: (async function* () { yield "ok"; })(), usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }) }));
    const generator = replyDeltas({ text: "x", language: "en", top: [cards[0]], loosened: ["Wed 7 Oct", "Central"], stream });
    while (!(await generator.next()).done) { /* drain */ }
    const call = stream.mock.calls[0][0];
    expect(JSON.parse(call.prompt).loosened).toEqual(["Wed 7 Oct", "Central"]);
    expect(call.system).toMatch(/loosened/u);
  });

  it("speaks in the chosen assistant's style", async () => {
    const stream = vi.fn<StreamReply>(() => ({ textStream: (async function* () { yield "ok"; })(), usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }) }));
    const generator = replyDeltas({ text: "x", language: "en", top: [cards[0]], style: "Playful and a little witty, still clear.", stream });
    while (!(await generator.next()).done) { /* drain */ }
    expect(stream.mock.calls[0][0].system).toContain("Playful and a little witty, still clear.");
  });

  it("ends quietly when there is nothing to recommend or DeepSeek fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing: StreamReply = () => ({ textStream: (async function* () { throw new Error("down"); })(), usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }) });
    for (const input of [{ top: [], stream: failing }, { top: [cards[0]], stream: failing }]) {
      const generator = replyDeltas({ text: "x", language: "zh", ...input });
      const step = await generator.next();
      expect(step).toEqual({ done: true, value: { inputTokens: 0, outputTokens: 0 } });
    }
  });
});
