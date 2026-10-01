import { describe, expect, it } from "vitest";
import { followUpFor } from "../components/ask/follow-up";
import { INITIAL_ASK_STATE, type AskViewState } from "../components/ask/use-ask-stream";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00", venue: "Aotea", href: "/events/a", imageUrl: null, priceText: null, sessionCount: 1, score: 1 };
const labels = (state: AskViewState, language: "en" | "zh" = "en") => followUpFor(state, language).options.map((option) => option.label);

function done(overrides: Partial<AskViewState>): AskViewState {
  return { ...INITIAL_ASK_STATE, status: "done", cards: [card], filters: EMPTY_FILTERS, ...overrides };
}

describe("followUpFor", () => {
  it("asks for a day first when none was given", () => {
    expect(followUpFor(done({}), "en")).toEqual({
      text: "Which day suits you?",
      options: [
        { label: "Tonight", kind: "refine" }, { label: "This weekend", kind: "refine" }, { label: "This week", kind: "refine" },
        { label: "Start over", kind: "restart" },
      ],
    });
    expect(followUpFor(done({}), "zh").text).toBe("哪天方便？");
  });

  it("then asks which part of town, except for movies-only searches", () => {
    const dated = { ...EMPTY_FILTERS, dates: ["2026-10-03"] };
    expect(followUpFor(done({ filters: dated }), "en").text).toBe("Any part of town you prefer?");
    expect(labels(done({ filters: dated }))).toEqual(["Central", "North Shore", "East Auckland", "West Auckland", "Start over"]);
    expect(followUpFor(done({ filters: { ...dated, domain: "movies" } }), "en").text).toBe("Want me to tweak anything?");
  });

  it("offers tweaks that fit the filters once day and area are known", () => {
    const state = done({ filters: { ...EMPTY_FILTERS, area: "central", dates: ["2026-10-07"], category: "music" } });
    expect(followUpFor(state, "en").text).toBe("Want me to tweak anything?");
    expect(labels(state)).toEqual(["Anywhere in Auckland", "Any day this week", "Any kind of event", "Start over"]);
    const evening = done({ filters: { ...EMPTY_FILTERS, dates: ["2026-10-03"], area: "east", timeOfDay: "evening", free: true } });
    expect(labels(evening, "zh")).toEqual(["奥克兰哪里都行", "这周哪天都行", "什么时间都行", "重新开始"]);
  });

  it("is honest about loosened and empty searches and doesn't offer to loosen twice", () => {
    const loosened = done({ relaxed: ["area"], filters: { ...EMPTY_FILTERS, area: "central", free: true } });
    expect(followUpFor(loosened, "en").text).toBe("Nothing matched exactly, so these are the closest. Want to adjust?");
    expect(labels(loosened)).toEqual(["In the evening", "Start over"]);
    expect(followUpFor(done({ cards: [] }), "zh").text).toBe("放宽条件后还是没找到，试试这些？");
  });
});
