"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { clearChip } from "../../lib/ask/chips";
import { readEvents } from "../../lib/ask/ndjson";
import type { AskCard, AskChip, AskErrorCode, AskFilters, AskStreamEvent } from "../../lib/ask/schema";

type Language = "en" | "zh";
const MAX_HISTORY = 5;
const NETWORK_MESSAGE: Record<Language, string> = { en: "Couldn't reach KiwiCue. Check your connection.", zh: "连接不上 KiwiCue，请检查网络。" };

export type AskViewState = {
  status: "idle" | "thinking" | "streaming" | "done" | "error";
  text: string; filters: AskFilters | null; chips: AskChip[]; cards: AskCard[]; bestId: string | null;
  reply: string; notices: string[]; relaxed: string[]; error: { code: AskErrorCode; message: string } | null; remaining: number | null; history: string[];
};
export const INITIAL_ASK_STATE: AskViewState = {
  status: "idle", text: "", filters: null, chips: [], cards: [], bestId: null, reply: "", notices: [], relaxed: [], error: null, remaining: null, history: [],
};
type Action = { type: "start"; text: string } | { type: "event"; event: AskStreamEvent } | { type: "fail"; message: string } | { type: "reset" };

function applyEvent(state: AskViewState, event: AskStreamEvent): AskViewState {
  switch (event.type) {
    case "understood": return { ...state, status: "streaming", filters: event.filters, chips: event.chips };
    case "result": return { ...state, cards: [...state.cards, event.card] };
    case "best": return { ...state, bestId: event.id };
    case "relaxed": return { ...state, relaxed: event.keys };
    case "media": return {
      ...state,
      cards: state.cards.map((item) => item.id === event.id ? { ...item, imageUrl: event.imageUrl ?? item.imageUrl, trailerKey: event.trailerKey } : item),
    };
    case "reply": return { ...state, reply: state.reply + event.delta };
    case "notice": return { ...state, notices: [...new Set([...state.notices, event.message])] };
    case "done": {
      // Removing a chip re-runs the same question; it should not appear twice in the history.
      const history = state.history.at(-1) === state.text ? state.history : [...state.history, state.text].slice(-MAX_HISTORY);
      return { ...state, status: "done", remaining: event.remaining, history };
    }
    case "error": return { ...state, status: "error", error: { code: event.code, message: event.message } };
  }
}

export function askReducer(state: AskViewState, action: Action): AskViewState {
  if (action.type === "reset") return INITIAL_ASK_STATE;
  if (action.type === "fail") return { ...state, status: "error", error: { code: "internal", message: action.message } };
  if (action.type === "start") return { ...state, status: "thinking", text: action.text, cards: [], bestId: null, reply: "", notices: [], relaxed: [], error: null };
  return applyEvent(state, action.event);
}

export function useAskStream(fetchImpl: typeof fetch = fetch) {
  const [state, dispatch] = useReducer(askReducer, INITIAL_ASK_STATE);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  const controller = useRef<AbortController | null>(null);

  const send = useCallback(async (text: string, language: Language, previous: AskFilters | null, refineOnly: boolean, history = latest.current.history) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: "start", text });
    try {
      const response = await fetchImpl("/api/ask", {
        method: "POST", signal: abort.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, language, previous, history, refineOnly }),
      });
      if (!response.body) throw new TypeError("Empty response");
      for await (const event of readEvents(response.body)) dispatch({ type: "event", event });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return; // Superseded by a newer question.
      dispatch({ type: "fail", message: NETWORK_MESSAGE[language] });
    }
  }, [fetchImpl]);

  /**
   * A plain ask refines the previous search. Kiwi's confirmed searches pass the conversation as
   * history and start from no filters, because the confirmed text already carries every detail.
   */
  const ask = useCallback((text: string, language: Language, options?: { history: string[]; fresh: boolean }) =>
    send(text, language, options?.fresh ? null : latest.current.filters, false, options?.history), [send]);
  const removeChip = useCallback((key: string, language: Language) => {
    const { filters, text } = latest.current;
    return filters ? send(text, language, clearChip(filters, key), true) : Promise.resolve();
  }, [send]);
  const reset = useCallback(() => { controller.current?.abort(); dispatch({ type: "reset" }); }, []);
  return { state, ask, removeChip, reset };
}
