import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_ASK_STATE, type AskViewState } from "../components/ask/use-ask-stream";
import { botState, DOZE_AFTER_MS, MOOD_HOLD_MS, moodOf, useBotFace } from "../components/ask/use-bot-face";

const card = { kind: "event" as const, id: "a", title: "Jazz", when: "2026-10-03T19:00", venue: "Aotea", href: "/events/a", imageUrl: null, priceText: null, sessionCount: 1, score: 1 };
const state = (patch: Partial<AskViewState>): AskViewState => ({ ...INITIAL_ASK_STATE, ...patch });
const quiet = { listening: false, speaking: false, asleep: false };

describe("botState", () => {
  it("follows the mic, the voice and the stream", () => {
    expect(botState({ ...quiet, listening: true, search: state({ status: "thinking" }) })).toBe("listening");
    expect(botState({ ...quiet, search: state({ status: "thinking" }) })).toBe("thinking");
    expect(botState({ ...quiet, search: state({ status: "streaming", searching: true }) })).toBe("searching");
    expect(botState({ ...quiet, search: state({ status: "streaming", reply: "Two good" }) })).toBe("speaking");
    expect(botState({ ...quiet, search: state({ status: "error" }) })).toBe("error");
    expect(botState({ ...quiet, asleep: true, search: state({ status: "done" }) })).toBe("sleeping");
  });
});

describe("moodOf", () => {
  it("prefers the reply's own mood, else reads how the search went", () => {
    expect(moodOf(state({ status: "streaming", mood: "excited" }))).toBe("excited");
    expect(moodOf(state({ status: "done", layout: "grid", cards: [card] }))).toBe("happy");
    expect(moodOf(state({ status: "done", layout: "grid", cards: [card], relaxed: ["area"] }))).toBe("curious");
    expect(moodOf(state({ status: "done", layout: "grid" }))).toBe("sorry");
    expect(moodOf(state({ status: "done" }))).toBeNull();
  });
});

describe("useBotFace", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lets the mood fade after the assistant stops talking", () => {
    const done = state({ status: "done", mood: "happy" });
    const { result, rerender } = renderHook(({ speaking }) => useBotFace(false, speaking, done), { initialProps: { speaking: true } });
    expect(result.current).toEqual({ state: "speaking", mood: "happy" });
    rerender({ speaking: false });
    expect(result.current.mood).toBe("happy");
    act(() => vi.advanceTimersByTime(MOOD_HOLD_MS));
    expect(result.current.mood).toBeNull();
  });

  it("dozes off when left alone and wakes when the visitor moves", () => {
    const { result } = renderHook(() => useBotFace(false, false, INITIAL_ASK_STATE));
    act(() => vi.advanceTimersByTime(DOZE_AFTER_MS));
    expect(result.current.state).toBe("sleeping");
    act(() => { window.dispatchEvent(new Event("pointermove")); });
    expect(result.current.state).toBe("idle");
  });
});
