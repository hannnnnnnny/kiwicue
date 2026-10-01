import { afterEach, describe, expect, it, vi } from "vitest";
import type { Evaluate } from "../lib/ask/jev";
import { rankCards } from "../lib/ask/rank";
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
