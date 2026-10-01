import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAskChat } from "../components/ask/use-ask-chat";
import { INITIAL_ASK_STATE, type AskViewState } from "../components/ask/use-ask-stream";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00", venue: "Aotea", href: "/events/a", imageUrl: null, priceText: null, sessionCount: 1, score: 1 };
const finished: AskViewState = { ...INITIAL_ASK_STATE, status: "done", text: "music", filters: EMPTY_FILTERS, cards: [card] };

function setup() {
  const search = vi.fn();
  const reset = vi.fn();
  const hook = renderHook(({ searchState }) => useAskChat({ language: "en", search, reset, searchState }), { initialProps: { searchState: INITIAL_ASK_STATE } });
  return { ...hook, search, reset };
}

describe("useAskChat", () => {
  it("greets with starters, then searches straight away on every message", () => {
    const { result, search } = setup();
    expect(result.current.entries).toEqual([expect.objectContaining({ role: "assistant", text: expect.stringContaining("Kiwi"), quickReplies: expect.arrayContaining(["Something this weekend"]) })]);
    act(() => result.current.send("  live music  ", "voice"));
    expect(search).toHaveBeenCalledWith("live music");
    expect(result.current.entries.slice(1).map((entry) => entry.role)).toEqual(["user", "results"]);
    expect(result.current.lastInput).toBe("voice");
    act(() => result.current.send("   ", "text"));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("adds Kiwi's follow-up once results are in, and folds earlier results into a snapshot", () => {
    const { result, rerender, search } = setup();
    act(() => result.current.send("live music", "text"));
    rerender({ searchState: finished });
    expect(result.current.entries.at(-1)).toMatchObject({ role: "followup", text: "Which day suits you?" });
    rerender({ searchState: { ...finished } });
    expect(result.current.entries.filter((entry) => entry.role === "followup")).toHaveLength(1);

    act(() => result.current.followUp({ label: "This weekend", kind: "refine" }));
    expect(search).toHaveBeenLastCalledWith("This weekend");
    const results = result.current.entries.filter((entry) => entry.role === "results");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ snapshot: finished });
    expect(results[1]).toMatchObject({ snapshot: null });
  });

  it("starts over with a fresh search and a new greeting", () => {
    const { result, rerender, reset } = setup();
    act(() => result.current.send("live music", "text"));
    rerender({ searchState: finished });
    act(() => result.current.followUp({ label: "Start over", kind: "restart" }));
    expect(reset).toHaveBeenCalled();
    expect(result.current.entries.at(-1)).toMatchObject({ role: "assistant", text: "Sure — what are you after this time?" });
    expect(result.current.entries.find((entry) => entry.role === "results")).toMatchObject({ snapshot: finished });
  });
});
