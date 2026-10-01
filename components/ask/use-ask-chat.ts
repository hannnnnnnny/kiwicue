"use client";

import { useCallback, useReducer } from "react";
import { MAX_HISTORY, MAX_SHOWN, type AskCard, type AskChatTurn, type AskShown } from "../../lib/ask/schema";
import type { AskContext, AskViewState } from "./use-ask-stream";
import { trustedBookingUrl } from "../../lib/ask/booking";

type Language = "en" | "zh";
export type InputMode = "voice" | "text";
export type ChatEntry =
  | { id: string; role: "assistant"; text: string; quickReplies: string[] }
  | { id: string; role: "user"; text: string }
  | { id: string; role: "results"; snapshot: AskViewState | null };
type ChatState = { entries: ChatEntry[]; lastInput: InputMode };
type Action =
  | { type: "user"; text: string; via: InputMode; snapshot: AskViewState }
  | { type: "say"; text: string; quickReplies: string[]; snapshot: AskViewState };

const MAX_TEXT = 300;
const MAX_TURN = 1200;
const copy = {
  en: {
    greeting: (name: string) => `Hi, I'm ${name}! What are you in the mood for in Auckland?`,
    starters: ["Something this weekend", "Fun with the kids", "A movie tonight", "Free things to do"],
    restart: "Sure — what are you after this time?",
    introduce: (name: string) => `Hi, I'm ${name} — I'll take it from here!`,
  },
  zh: {
    greeting: (name: string) => `嗨，我是 ${name}！想在奥克兰找点什么好玩的？`,
    starters: ["这个周末去哪玩", "带孩子出去玩", "今晚看场电影", "免费的活动"],
    restart: "好的，这次想找点什么？",
    introduce: (name: string) => `嗨，我是 ${name}，接下来交给我吧！`,
  },
} as const;

let nextId = 0;
const id = () => `chat-${(nextId += 1)}`;

/** Earlier result messages keep what they showed; only the newest one follows the live search. */
function freezeResults(entries: ChatEntry[], snapshot: AskViewState): ChatEntry[] {
  return entries.map((entry) => entry.role === "results" && !entry.snapshot ? { ...entry, snapshot } : entry);
}

function reducer(state: ChatState, action: Action): ChatState {
  if (action.type === "user") {
    return {
      lastInput: action.via,
      entries: [...freezeResults(state.entries, action.snapshot), { id: id(), role: "user", text: action.text }, { id: id(), role: "results", snapshot: null }],
    };
  }
  return { ...state, entries: [...freezeResults(state.entries, action.snapshot), { id: id(), role: "assistant", text: action.text, quickReplies: action.quickReplies }] };
}

/** The chat as the model should see it: what each side said, oldest first, newest kept. */
export function conversation(entries: ChatEntry[], live: AskViewState): AskChatTurn[] {
  const turns = entries.flatMap((entry): AskChatTurn[] => {
    const text = entry.role === "results" ? (entry.snapshot ?? live).reply : entry.text;
    const role = entry.role === "user" ? "user" : "assistant";
    return text.trim() ? [{ role, text: text.trim().slice(0, MAX_TURN) }] : [];
  });
  return turns.slice(-MAX_HISTORY);
}

function shownWhen(card: AskCard): string {
  const date = new Date(card.when);
  if (!Number.isFinite(date.getTime())) return card.when.slice(0, 40);
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/** The cards on screen now, in the order shown, so "the second one" means something. */
export function onScreen(entries: ChatEntry[], live: AskViewState): AskShown[] {
  const states = entries.flatMap((entry) => entry.role === "results" ? [entry.snapshot ?? live] : []);
  const latest = [...states].reverse().find((state) => state.cards.length > 0);
  if (!latest) return [];
  const best = latest.cards.find((card) => card.id === latest.bestId);
  const ordered = best ? [best, ...latest.cards.filter((card) => card !== best)] : latest.cards;
  return ordered.slice(0, MAX_SHOWN).map((card) => ({ kind: card.kind, title: card.title, when: shownWhen(card), venue: card.venue, price: card.priceText,
    ...(card.bookingUrl ? { bookingUrl: trustedBookingUrl(card.bookingUrl) } : {}), href: card.href }));
}

/** The assistant's thread: every message goes to the assistant with the conversation so far. */
export function useAskChat({ language, name, search, reset, searchState }: {
  language: Language; name: string; search(text: string, context: AskContext): void; reset(): void; searchState: AskViewState;
}) {
  const [state, dispatch] = useReducer(reducer, language, (initial): ChatState => ({
    entries: [{ id: id(), role: "assistant", text: copy[initial].greeting(name), quickReplies: [...copy[initial].starters] }],
    lastInput: "text",
  }));

  const send = useCallback((text: string, via: InputMode) => {
    const trimmed = text.trim().slice(0, MAX_TEXT);
    if (!trimmed) return;
    const context = { history: conversation(state.entries, searchState), shown: onScreen(state.entries, searchState) };
    dispatch({ type: "user", text: trimmed, via, snapshot: searchState });
    search(trimmed, context);
  }, [search, searchState, state.entries]);

  const restart = useCallback(() => {
    dispatch({ type: "say", text: copy[language].restart, quickReplies: [...copy[language].starters], snapshot: searchState });
    reset();
  }, [language, reset, searchState]);

  /** A newly chosen assistant says hello, keeping the conversation and results so far. */
  const introduce = useCallback((nextName: string) =>
    dispatch({ type: "say", text: copy[language].introduce(nextName), quickReplies: [], snapshot: searchState }), [language, searchState]);
  return { ...state, send, restart, introduce };
}
