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
    expect(state).toMatchObject({ status: "done", text: "kids", cards: [card], bestId: "a", reply: "Try this.", remaining: 3, history: ["kids"], chips: [{ key: "kids" }] });
  });
});

describe("useAskStream", () => {
  it("sends previous filters and history on a follow-up", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ndjson([
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [] },
      { type: "done", remaining: 4, tier: "guest" },
    ]));
    const { result } = renderHook(() => useAskStream(fetchImpl));
    await act(() => result.current.ask("with kids", "en"));
    await act(() => result.current.ask("in the evening", "en"));
    const body = JSON.parse(String(fetchImpl.mock.calls[1][1]?.body));
    expect(body).toEqual({ text: "in the evening", language: "en", previous: { ...EMPTY_FILTERS, kids: true }, history: ["with kids"], refineOnly: false });
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
