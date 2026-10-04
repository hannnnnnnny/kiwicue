import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { conversation, onScreen, useAskChat, type ChatEntry } from "../components/ask/use-ask-chat";
import { INITIAL_ASK_STATE, type AskViewState } from "../components/ask/use-ask-stream";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const card = (id: string, title: string) => ({ kind: "event" as const, id, title, when: "2026-10-03T19:00:00+13:00", venue: "Aotea", href: `/events/${id}`, imageUrl: null, priceText: "Free", sessionCount: 1, score: 1 });
const finished: AskViewState = { ...INITIAL_ASK_STATE, status: "done", text: "music", filters: EMPTY_FILTERS, cards: [card("a", "Jazz"), card("b", "Indie")], bestId: "b", reply: "Try **Indie**." };

function setup() {
  const search = vi.fn();
  const reset = vi.fn();
  const hook = renderHook(({ searchState }) => useAskChat({ language: "en", name: "Fern", search, reset, searchState }), { initialProps: { searchState: INITIAL_ASK_STATE } });
  return { ...hook, search, reset };
}

describe("conversation and onScreen", () => {
  const entries: ChatEntry[] = [
    { id: "g", role: "assistant", text: "Hi, I'm Fern!", quickReplies: [] },
    { id: "1", role: "user", text: "music" },
    { id: "r", role: "results", snapshot: null },
  ];

  it("gives the model both sides of the chat, including the assistant's replies", () => {
    expect(conversation(entries, finished)).toEqual([
      { role: "assistant", text: "Hi, I'm Fern!" }, { role: "user", text: "music" }, { role: "assistant", text: "Try **Indie**." },
    ]);
    const long: ChatEntry[] = Array.from({ length: 20 }, (_, index) => ({ id: `${index}`, role: "user", text: `m${index}` }));
    expect(conversation(long, INITIAL_ASK_STATE)).toHaveLength(12);
    expect(conversation(long, INITIAL_ASK_STATE).at(-1)?.text).toBe("m19");
  });

  it("lists what's on screen, best match first, from the latest results that have cards", () => {
    const later: ChatEntry[] = [...entries.slice(0, 2), { id: "r", role: "results", snapshot: finished }, { id: "2", role: "user", text: "thanks" }, { id: "r2", role: "results", snapshot: null }];
    expect(onScreen(later, INITIAL_ASK_STATE)).toEqual([
      { kind: "event", title: "Indie", href: "/events/b", when: "Sat, 3 Oct, 7:00 pm", venue: "Aotea", price: "Free" },
      { kind: "event", title: "Jazz", href: "/events/a", when: "Sat, 3 Oct, 7:00 pm", venue: "Aotea", price: "Free" },
    ]);
    expect(onScreen(entries.slice(0, 2), INITIAL_ASK_STATE)).toEqual([]);
  });
});

describe("useAskChat", () => {
  it("greets as the assistant chosen after loading, then keeps that greeting once the chat moves on", () => {
    const search = vi.fn();
    const { result, rerender } = renderHook(({ name }) => useAskChat({ language: "en", name, search, reset: vi.fn(), searchState: INITIAL_ASK_STATE }), { initialProps: { name: "Fern" } });
    rerender({ name: "Iris" });
    expect(result.current.entries[0]).toMatchObject({ text: "Hi, I'm Iris! What are you in the mood for in Auckland?" });
    act(() => result.current.send("live music", "text"));
    rerender({ name: "Kai" });
    expect(result.current.entries[0]).toMatchObject({ text: "Hi, I'm Iris! What are you in the mood for in Auckland?" });
  });

  it("greets with starters, then sends every message with the conversation so far", () => {
    const { result, rerender, search } = setup();
    expect(result.current.entries).toEqual([expect.objectContaining({ role: "assistant", text: "Hi, I'm Fern! What are you in the mood for in Auckland?" })]);
    act(() => result.current.send("  live music  ", "voice"));
    expect(search).toHaveBeenCalledWith("live music", { history: [{ role: "assistant", text: "Hi, I'm Fern! What are you in the mood for in Auckland?" }], shown: [] });
    expect(result.current.lastInput).toBe("voice");

    rerender({ searchState: finished });
    act(() => result.current.send("is the second one free?", "text"));
    const [, context] = search.mock.calls[1];
    expect(context.history.at(-1)).toEqual({ role: "assistant", text: "Try **Indie**." });
    expect(context.shown.map((item: { title: string }) => item.title)).toEqual(["Indie", "Jazz"]);
    const results = result.current.entries.filter((entry) => entry.role === "results");
    expect(results[0]).toMatchObject({ snapshot: finished });
    expect(results[1]).toMatchObject({ snapshot: null });
    act(() => result.current.send("   ", "text"));
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("starts over and lets a new assistant introduce itself", () => {
    const { result, reset } = setup();
    act(() => result.current.introduce("Sunny"));
    expect(result.current.entries.at(-1)).toMatchObject({ role: "assistant", text: "Hi, I'm Sunny — I'll take it from here!", quickReplies: [] });
    act(() => result.current.restart());
    expect(reset).toHaveBeenCalled();
    expect(result.current.entries.at(-1)).toMatchObject({ text: "Sure — what are you after this time?", quickReplies: expect.arrayContaining(["A movie tonight"]) });
  });
});
