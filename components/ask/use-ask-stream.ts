"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { clearChip } from "../../lib/ask/chips";
import type { AskMood } from "../../lib/ask/mood";
import { readEvents } from "../../lib/ask/ndjson";
import type { AskCard, AskChatTurn, AskChip, AskErrorCode, AskFilters, AskLayout, AskShown, AskStreamEvent } from "../../lib/ask/schema";
import { DEFAULT_ASSISTANT, type AssistantId } from "../../lib/assistants";

type Language = "en" | "zh";
const NETWORK_MESSAGE: Record<Language, string> = { en: "Couldn't reach KiwiCue. Check your connection.", zh: "连接不上 KiwiCue，请检查网络。" };

export type AskViewState = {
  status: "idle" | "thinking" | "streaming" | "done" | "error";
  text: string; filters: AskFilters | null; chips: AskChip[]; cards: AskCard[]; bestId: string | null; layout: AskLayout | null;
  reply: string; notices: string[]; relaxed: string[]; error: { code: AskErrorCode; message: string } | null; remaining: number | null;
  /** How the assistant feels about its reply, and whether a search is running with nothing found yet. */
  mood: AskMood | null; searching: boolean;
};
export const INITIAL_ASK_STATE: AskViewState = {
  status: "idle", text: "", filters: null, chips: [], cards: [], bestId: null, layout: null, reply: "", notices: [], relaxed: [], error: null, remaining: null, mood: null, searching: false,
};
export type AskContext = { history: AskChatTurn[]; shown: AskShown[] };
type Action = { type: "start"; text: string } | { type: "event"; event: AskStreamEvent } | { type: "fail"; message: string } | { type: "reset" };

function applyEvent(state: AskViewState, event: AskStreamEvent): AskViewState {
  switch (event.type) {
    // A second search in the same answer replaces the first one's cards.
    case "understood": return { ...state, status: "streaming", filters: event.filters, chips: event.chips, cards: [], bestId: null, relaxed: [], layout: null, searching: true };
    case "result": return { ...state, cards: [...state.cards, event.card], searching: false };
    case "best": return { ...state, bestId: event.id };
    case "relaxed": return { ...state, relaxed: event.keys };
    case "media": return {
      ...state,
      cards: state.cards.map((item) => item.id === event.id ? { ...item, imageUrl: event.imageUrl ?? item.imageUrl, trailerKey: event.trailerKey } : item),
    };
    case "layout": return { ...state, layout: event.layout, searching: false };
    case "mood": return { ...state, mood: event.mood };
    case "reply": return { ...state, status: "streaming", reply: state.reply + event.delta, searching: false };
    case "notice": return { ...state, notices: [...new Set([...state.notices, event.message])] };
    case "done": return { ...state, status: "done", remaining: event.remaining, searching: false };
    case "error": return { ...state, status: "error", error: { code: event.code, message: event.message }, searching: false };
  }
}

/** Each message starts with no cards or reply of its own; the filters carry over so the next message can refine them. */
export function askReducer(state: AskViewState, action: Action): AskViewState {
  if (action.type === "reset") return INITIAL_ASK_STATE;
  if (action.type === "fail") return { ...state, status: "error", error: { code: "internal", message: action.message }, searching: false };
  if (action.type === "start") return { ...state, status: "thinking", text: action.text, chips: [], cards: [], bestId: null, layout: null, reply: "", notices: [], relaxed: [], error: null, mood: null, searching: false };
  return applyEvent(state, action.event);
}

export function useAskStream(fetchImpl: typeof fetch = fetch, assistant: AssistantId = DEFAULT_ASSISTANT) {
  const [state, dispatch] = useReducer(askReducer, INITIAL_ASK_STATE);
  const latest = useRef(state);
  const speaker = useRef(assistant);
  useEffect(() => { speaker.current = assistant; }, [assistant]);
  useEffect(() => { latest.current = state; }, [state]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const send = useCallback(async (body: { text: string; language: Language; previous: AskFilters | null; refineOnly: boolean } & AskContext) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: "start", text: body.text });
    try {
      const response = await fetchImpl("/api/ask", {
        method: "POST", signal: abort.signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, assistant: speaker.current }),
      });
      if (!response.body) throw new TypeError("Empty response");
      let completed = false;
      for await (const event of readEvents(response.body)) {
        if (abort.signal.aborted || controller.current !== abort) return;
        completed ||= event.type === "done" || event.type === "error";
        dispatch({ type: "event", event });
      }
      if (!abort.signal.aborted && controller.current === abort && !completed) {
        dispatch({ type: "fail", message: NETWORK_MESSAGE[body.language] });
      }
    } catch (error) {
      if (abort.signal.aborted || controller.current !== abort || (error instanceof DOMException && error.name === "AbortError")) return;
      dispatch({ type: "fail", message: NETWORK_MESSAGE[body.language] });
    }
  }, [fetchImpl]);

  /** Sends a message with the conversation so far; the server refines the current filters if it searches. */
  const ask = useCallback((text: string, language: Language, context: AskContext = { history: [], shown: [] }) =>
    send({ text, language, previous: latest.current.filters, refineOnly: false, ...context }), [send]);
  const removeChip = useCallback((key: string, language: Language) => {
    const { filters, text } = latest.current;
    return filters ? send({ text, language, previous: clearChip(filters, key), refineOnly: true, history: [], shown: [] }) : Promise.resolve();
  }, [send]);
  const reset = useCallback(() => { controller.current?.abort(); dispatch({ type: "reset" }); }, []);
  return { state, ask, removeChip, reset };
}
