"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { askChatResponseSchema, type AskChatMessage, type AskChatResponse } from "../../lib/ask/chat-schema";
import { ASK_ERROR_CODES, type AskErrorCode } from "../../lib/ask/schema";
import type { AskViewState } from "./use-ask-stream";

type Language = "en" | "zh";
export type InputMode = "voice" | "text";
export type ChatEntry =
  | { id: string; role: "assistant"; text: string; quickReplies: string[] }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "proposal"; summary: string; searchText: string; status: "pending" | "confirmed" | "changed" }
  | { id: string; role: "results"; snapshot: AskViewState | null };
type ChatError = { code: AskErrorCode; message: string };
type ChatState = { entries: ChatEntry[]; pending: boolean; error: ChatError | null; remaining: number | null; lastInput: InputMode };
type Action =
  | { type: "user"; text: string; via: InputMode }
  | { type: "turn"; turn: AskChatResponse }
  | { type: "fail"; error: ChatError }
  | { type: "confirm"; snapshot: AskViewState | null }
  | { type: "change"; text: string };

const copy = {
  en: {
    greeting: "Hi, I'm Kiwi! What are you in the mood for in Auckland?",
    starters: ["Something this weekend", "Fun with the kids", "A movie tonight", "Free things to do"],
    change: "Sure — what would you like to change?", offline: "I couldn't reach KiwiCue. Check your connection and try again.",
  },
  zh: {
    greeting: "嗨，我是 Kiwi！想在奥克兰找点什么好玩的？",
    starters: ["这个周末去哪玩", "带孩子出去玩", "今晚看场电影", "免费的活动"],
    change: "好的，你想改哪一点？", offline: "连接不上 KiwiCue，请检查网络后再试。",
  },
} as const;

let nextId = 0;
const id = () => `chat-${(nextId += 1)}`;

/** The API sees only the conversation since the last search, so every search starts a fresh 6-turn window. */
export function chatWindow(entries: ChatEntry[]): AskChatMessage[] {
  const lastResults = entries.map((entry) => entry.role).lastIndexOf("results");
  return entries.slice(lastResults + 1).flatMap((entry): AskChatMessage[] =>
    entry.role === "user" || entry.role === "assistant" ? [{ role: entry.role, text: entry.text }] : []);
}

function withTurn(state: ChatState, turn: AskChatResponse): ChatState {
  const reply: ChatEntry = { id: id(), role: "assistant", text: turn.reply, quickReplies: turn.quickReplies };
  const proposal: ChatEntry[] = turn.ready && turn.searchText
    ? [{ id: id(), role: "proposal", summary: turn.summary ?? turn.searchText, searchText: turn.searchText, status: "pending" }]
    : [];
  return { ...state, pending: false, remaining: turn.remaining, entries: [...state.entries, reply, ...proposal] };
}

function settleProposal(entries: ChatEntry[], status: "confirmed" | "changed"): ChatEntry[] {
  return entries.map((entry) => entry.role === "proposal" && entry.status === "pending" ? { ...entry, status } : entry);
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "user": return { ...state, pending: true, error: null, lastInput: action.via, entries: [...settleProposal(state.entries, "changed"), { id: id(), role: "user", text: action.text }] };
    case "turn": return withTurn(state, action.turn);
    case "fail": return { ...state, pending: false, error: action.error };
    case "change": return { ...state, entries: [...settleProposal(state.entries, "changed"), { id: id(), role: "assistant", text: action.text, quickReplies: [] }] };
    case "confirm": {
      // Earlier result messages keep what they showed; only the newest one follows the live search.
      const frozen = state.entries.map((entry) => entry.role === "results" && !entry.snapshot ? { ...entry, snapshot: action.snapshot } : entry);
      return { ...state, error: null, entries: [...settleProposal(frozen, "confirmed"), { id: id(), role: "results", snapshot: null }] };
    }
  }
}

async function requestTurn(fetchImpl: typeof fetch, language: Language, messages: AskChatMessage[]): Promise<AskChatResponse | ChatError> {
  const response = await fetchImpl("/api/ask/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language, messages }),
  });
  const body: unknown = await response.json();
  const turn = askChatResponseSchema.safeParse(body);
  if (response.ok && turn.success) return turn.data;
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  const code = ASK_ERROR_CODES.find((item) => item === error?.code) ?? "internal";
  return { code, message: typeof error?.message === "string" ? error.message : copy[language].offline };
}

export function useAskChat({ language, fetchImpl = fetch, search, searchState = null }: {
  language: Language; fetchImpl?: typeof fetch; search(text: string, history: string[]): void; searchState?: AskViewState | null;
}) {
  const [state, dispatch] = useReducer(reducer, language, (initial): ChatState => ({
    entries: [{ id: id(), role: "assistant", text: copy[initial].greeting, quickReplies: [...copy[initial].starters] }],
    pending: false, error: null, remaining: null, lastInput: "text",
  }));
  const entries = useRef(state.entries);
  useEffect(() => { entries.current = state.entries; }, [state.entries]);

  const send = useCallback(async (text: string, via: InputMode) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const messages = [...chatWindow(entries.current), { role: "user" as const, text: trimmed.slice(0, 300) }];
    dispatch({ type: "user", text: trimmed, via });
    try {
      const result = await requestTurn(fetchImpl, language, messages);
      dispatch("reply" in result ? { type: "turn", turn: result } : { type: "fail", error: result });
    } catch (error) {
      if (!(error instanceof TypeError) && !(error instanceof SyntaxError)) throw error;
      dispatch({ type: "fail", error: { code: "internal", message: copy[language].offline } });
    }
  }, [fetchImpl, language]);

  const confirm = useCallback(() => {
    const proposal = [...entries.current].reverse().find((entry) => entry.role === "proposal" && entry.status === "pending");
    if (!proposal || proposal.role !== "proposal") return;
    const history = chatWindow(entries.current).filter(({ role }) => role === "user").map(({ text }) => text).slice(-5);
    dispatch({ type: "confirm", snapshot: searchState });
    search(proposal.searchText, history);
  }, [search, searchState]);

  const change = useCallback(() => dispatch({ type: "change", text: copy[language].change }), [language]);
  return { ...state, send, confirm, change };
}
