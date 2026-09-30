import { describe, expect, it, vi } from "vitest";
import type { Evaluate, JevAnswer } from "../lib/ask/jev";
import { understandWithJev } from "../lib/ask/understand-jev";

function choice(value: string, probability = 0.9): JevAnswer {
  return { type: "choice", choice: value, probabilities: { [value]: probability } };
}

describe("understandWithJev", () => {
  it("maps confident answers and treats unmentioned or unsure ones as not set", async () => {
    const evaluate = vi.fn<Evaluate>().mockResolvedValue({
      inputTokens: 812,
      answers: {
        domain: choice("events"), when: choice("weekend"), timeOfDay: choice("unmentioned"),
        area: choice("east", 0.55), category: choice("family"), kids: choice("on"), free: choice("unmentioned"),
      },
    });
    const result = await understandWithJev({ text: "周末带孩子去东区", history: [], previous: null, today: "2026-10-01 (Thursday)", evaluate });
    expect(result).toEqual({
      inputTokens: 812,
      understanding: { domain: "events", when: "weekend", category: "family", kids: "on" },
    });
    const { state, questions } = evaluate.mock.calls[0][0];
    expect(state).toMatchObject({ latestMessage: "周末带孩子去东区", city: "Auckland, New Zealand", today: "2026-10-01 (Thursday)" });
    expect(Object.keys(questions).sort()).toEqual(["area", "category", "domain", "free", "kids", "timeOfDay", "when"]);
  });

  it("propagates provider errors so the caller can degrade", async () => {
    const evaluate = vi.fn<Evaluate>().mockRejectedValue(new Error("boom"));
    await expect(understandWithJev({ text: "hi", history: [], previous: null, today: "2026-10-01", evaluate })).rejects.toThrow("boom");
  });
});
