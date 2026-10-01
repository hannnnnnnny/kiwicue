"use client";

import { useCallback, useEffect, useReducer } from "react";
import { followUpFor, type FollowUp, type FollowUpOption } from "./follow-up";
import type { AskViewState } from "./use-ask-stream";

type Language = "en" | "zh";
export type InputMode = "voice" | "text";
export type ChatEntry =
  | { id: string; role: "assistant"; text: string; quickReplies: string[] }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "results"; snapshot: AskViewState | null }
  | { id: string; role: "followup"; text: string; options: FollowUpOption[] };
type ChatState = { entries: ChatEntry[]; lastInput: InputMode };
type Action =
  | { type: "user"; text: string; via: InputMode; snapshot: AskViewState | null }
  | { type: "followUp"; followUp: FollowUp }
  | { type: "restart"; text: string; quickReplies: string[]; snapshot: AskViewState | null };

const MAX_TEXT = 300;
const copy = {
  en: {
    greeting: "Hi, I'm Kiwi! What are you in the mood for in Auckland?",
    starters: ["Something this weekend", "Fun with the kids", "A movie tonight", "Free things to do"],
    restart: "Sure — what are you after this time?",
  },
  zh: {
    greeting: "嗨，我是 Kiwi！想在奥克兰找点什么好玩的？",
    starters: ["这个周末去哪玩", "带孩子出去玩", "今晚看场电影", "免费的活动"],
    restart: "好的，这次想找点什么？",
  },
} as const;

let nextId = 0;
const id = () => `chat-${(nextId += 1)}`;

/** Earlier result messages keep what they showed; only the newest one follows the live search. */
function freezeResults(entries: ChatEntry[], snapshot: AskViewState | null): ChatEntry[] {
  return entries.map((entry) => entry.role === "results" && !entry.snapshot ? { ...entry, snapshot } : entry);
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "user":
      return {
        lastInput: action.via,
        entries: [...freezeResults(state.entries, action.snapshot), { id: id(), role: "user", text: action.text }, { id: id(), role: "results", snapshot: null }],
      };
    case "followUp": {
      // Only a live, just-finished search gets a follow-up, and only once.
      const last = state.entries.at(-1);
      if (last?.role !== "results" || last.snapshot) return state;
      return { ...state, entries: [...state.entries, { id: id(), role: "followup", text: action.followUp.text, options: action.followUp.options }] };
    }
    case "restart":
      return { ...state, entries: [...freezeResults(state.entries, action.snapshot), { id: id(), role: "assistant", text: action.text, quickReplies: action.quickReplies }] };
  }
}

/** Kiwi's thread: every message searches at once and refines the last results; Kiwi then asks what's missing. */
export function useAskChat({ language, search, reset, searchState }: {
  language: Language; search(text: string): void; reset(): void; searchState: AskViewState;
}) {
  const [state, dispatch] = useReducer(reducer, language, (initial): ChatState => ({
    entries: [{ id: id(), role: "assistant", text: copy[initial].greeting, quickReplies: [...copy[initial].starters] }],
    lastInput: "text",
  }));

  const send = useCallback((text: string, via: InputMode) => {
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (!trimmed) return;
    dispatch({ type: "user", text: trimmed, via, snapshot: searchState });
    search(trimmed);
  }, [search, searchState]);

  const finished = searchState.status === "done" ? searchState : null;
  useEffect(() => { if (finished) dispatch({ type: "followUp", followUp: followUpFor(finished, language) }); }, [finished, language]);

  const followUp = useCallback((option: FollowUpOption) => {
    if (option.kind === "refine") { send(option.label, "text"); return; }
    dispatch({ type: "restart", text: copy[language].restart, quickReplies: [...copy[language].starters], snapshot: searchState });
    reset();
  }, [language, reset, searchState, send]);

  return { ...state, send, followUp };
}
