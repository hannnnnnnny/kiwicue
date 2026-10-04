import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { askReducer, INITIAL_ASK_STATE, useAskStream } from "../components/ask/use-ask-stream";
import { EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00", venue: "Aotea", href: "/events/a", imageUrl: null, priceText: null, sessionCount: 2, score: 1 };

function ndjson(events: AskStreamEvent[], status = 200): Response {
  return new Response(events.map((event) => JSON.stringify(event)).join("\n"), { status, headers: { "content-type": "application/x-ndjson" } });
}

describe("askReducer", () => {
  it("accumulates stream events", () => {
    let state = askReducer(INITIAL_ASK_STATE, { type: "start", text: "kids" });
    state = askReducer(state, { type: "event", event: { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [{ key: "kids", label: "With kids" }] } });
    state = askReducer(state, { type: "event", event: { type: "result", card } });
    state = askReducer(state, { type: "event", event: { type: "best", id: "a" } });
    state = askReducer(state, { type: "event", event: { type: "reply", delta: "Try " } });
    state = askReducer(state, { type: "event", event: { type: "reply", delta: "this." } });
    state = askReducer(state, { type: "event", event: { type: "done", remaining: 3, tier: "guest" } });
    expect(state).toMatchObject({ status: "done", text: "kids", cards: [card], bestId: "a", reply: "Try this.", remaining: 3, chips: [{ key: "kids" }] });
  });
});

describe("askReducer mood and searching", () => {
  it("knows while a search has found nothing yet, and keeps the reply's mood until the next message", () => {
    let state = askReducer(INITIAL_ASK_STATE, { type: "start", text: "jazz" });
    state = askReducer(state, { type: "event", event: { type: "understood", filters: EMPTY_FILTERS, chips: [] } });
    expect(state.searching).toBe(true);
    state = askReducer(state, { type: "event", event: { type: "result", card } });
    expect(state.searching).toBe(false);
    state = askReducer(state, { type: "event", event: { type: "mood", mood: "excited" } });
    state = askReducer(state, { type: "event", event: { type: "done", remaining: 3, tier: "guest" } });
    expect(state.mood).toBe("excited");
    expect(askReducer(state, { type: "start", text: "more" }).mood).toBeNull();
    const withdrawn = askReducer(askReducer(state, { type: "event", event: { type: "reply", delta: "Let me check." } }), { type: "event", event: { type: "reply-reset" } });
    expect(withdrawn.reply).toBe("");
  });
});

describe("askReducer relaxation", () => {
  it("fills in a card's picture and trailer when they arrive", () => {
    const withCard = askReducer(INITIAL_ASK_STATE, { type: "event", event: { type: "result", card } });
    const state = askReducer(withCard, { type: "event", event: { type: "media", id: "a", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" } });
    expect(state.cards[0]).toMatchObject({ imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" });
    expect(askReducer(withCard, { type: "event", event: { type: "media", id: "zzz", imageUrl: null, trailerKey: null } }).cards).toEqual([card]);
  });

  it("takes the assistant's layout, and lets a second search replace the first one's cards", () => {
    let state = askReducer(INITIAL_ASK_STATE, { type: "event", event: { type: "result", card } });
    state = askReducer(state, { type: "event", event: { type: "layout", layout: "timeline" } });
    expect(state.layout).toBe("timeline");
    state = askReducer(state, { type: "event", event: { type: "understood", filters: EMPTY_FILTERS, chips: [] } });
    expect(state).toMatchObject({ cards: [], layout: null, filters: EMPTY_FILTERS });
  });

  it("keeps the filters but clears the cards when the next message starts", () => {
    const searched = askReducer(INITIAL_ASK_STATE, { type: "event", event: { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [] } });
    const next = askReducer(askReducer(searched, { type: "event", event: { type: "result", card } }), { type: "start", text: "thanks" });
    expect(next).toMatchObject({ filters: { kids: true }, cards: [], reply: "" });
  });

  it("remembers which chips were loosened and clears them on the next question", () => {
    const relaxed = askReducer(INITIAL_ASK_STATE, { type: "event", event: { type: "relaxed", keys: ["area", "dates"] } });
    expect(relaxed.relaxed).toEqual(["area", "dates"]);
    expect(askReducer(relaxed, { type: "start", text: "again" }).relaxed).toEqual([]);
  });
});

describe("useAskStream", () => {
  it("sends previous filters, the conversation and what's on screen", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson([
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [] },
      { type: "done", remaining: 4, tier: "guest" },
    ]));
    const { result } = renderHook(() => useAskStream(fetchImpl));
    await act(() => result.current.ask("with kids", "en"));
    const shown = [{ kind: "event" as const, title: "Bundle Baby", when: "Sat 3 Oct", venue: null, price: null }];
    await act(() => result.current.ask("in the evening", "en", { history: [{ role: "user", text: "with kids" }, { role: "assistant", text: "Sure!" }], shown }));
    const body = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(body).toEqual({
      text: "in the evening", language: "en", previous: { ...EMPTY_FILTERS, kids: true }, refineOnly: false, assistant: "fern",
      history: [{ role: "user", text: "with kids" }, { role: "assistant", text: "Sure!" }], shown,
    });
  });

  it("tells the server which assistant is answering", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson([{ type: "done", remaining: 4, tier: "guest" }]));
    const { result } = renderHook(() => useAskStream(fetchImpl, "sunny"));
    await act(() => result.current.ask("hi", "en"));
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).assistant).toBe("sunny");
  });

  it("re-runs without understanding when a chip is removed", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson([{ type: "understood", filters: { ...EMPTY_FILTERS, kids: true, free: true }, chips: [] }, { type: "done", remaining: 4, tier: "guest" }]));
    const { result } = renderHook(() => useAskStream(fetchImpl));
    await act(() => result.current.ask("free kids stuff", "en"));
    await act(() => result.current.removeChip("free", "en"));
    const body = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(body).toMatchObject({ text: "free kids stuff", previous: { ...EMPTY_FILTERS, kids: true }, refineOnly: true });
  });

  it("shows server errors and network failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson([{ type: "error", code: "quota_exhausted", message: "Used up" }], 429));
    const { result } = renderHook(() => useAskStream(fetchImpl));
    await act(() => result.current.ask("hi", "en"));
    expect(result.current.state).toMatchObject({ status: "error", error: { code: "quota_exhausted" } });

    const offline = vi.fn<typeof fetch>(async () => { throw new TypeError("Failed to fetch"); });
    const second = renderHook(() => useAskStream(offline));
    await act(() => second.result.current.ask("hi", "en"));
    await waitFor(() => expect(second.result.current.state).toMatchObject({ status: "error", error: { code: "internal" } }));
  });
});
