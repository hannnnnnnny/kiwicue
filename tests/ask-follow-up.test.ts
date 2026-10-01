import { describe, expect, it } from "vitest";
import { followUpFor } from "../components/ask/follow-up";
import { INITIAL_ASK_STATE, type AskViewState } from "../components/ask/use-ask-stream";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00", venue: "Aotea", href: "/events/a", imageUrl: null, priceText: null, sessionCount: 1, score: 1 };

function done(overrides: Partial<AskViewState>): AskViewState {
  return { ...INITIAL_ASK_STATE, status: "done", filters: EMPTY_FILTERS, ...overrides };
}

describe("followUpFor", () => {
  it("offers refinements that fit the current filters, then Start over", () => {
    const state = done({ cards: [card], filters: { ...EMPTY_FILTERS, area: "central", dates: ["2026-10-07"], category: "music" } });
    expect(followUpFor(state, "en")).toEqual({
      text: "Want me to tweak anything?",
      options: [
        { label: "Anywhere in Auckland", kind: "refine" },
        { label: "Any day this week", kind: "refine" },
        { label: "Any kind of event", kind: "refine" },
        { label: "Start over", kind: "restart" },
      ],
    });
  });

  it("suggests evening and free when nothing narrows the search", () => {
    expect(followUpFor(done({ cards: [card] }), "zh").options.map((option) => option.label)).toEqual(["晚上的", "只要免费的", "重新开始"]);
    const evening = done({ cards: [card], filters: { ...EMPTY_FILTERS, timeOfDay: "evening", free: true } });
    expect(followUpFor(evening, "en").options.map((option) => option.label)).toEqual(["Any time of day", "Start over"]);
  });

  it("does not offer to loosen what the search already loosened", () => {
    const state = done({ cards: [card], relaxed: ["area"], filters: { ...EMPTY_FILTERS, area: "central", free: true } });
    expect(followUpFor(state, "en").options.map((option) => option.label)).toEqual(["In the evening", "Start over"]);
  });

  it("is honest about loosened and empty searches", () => {
    expect(followUpFor(done({ cards: [card], relaxed: ["area"] }), "en").text).toBe("Nothing matched exactly, so these are the closest. Want to adjust?");
    expect(followUpFor(done({ cards: [] }), "zh").text).toBe("放宽条件后还是没找到，试试这些？");
  });
});
