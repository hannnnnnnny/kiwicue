"use client";

import { useEffect, useState } from "react";
import type { AskMood } from "../../lib/ask/mood";
import type { BotState } from "./orb-face";
import type { AskViewState } from "./use-ask-stream";

// A mood lingers a little after the assistant goes quiet, then the face relaxes.
export const MOOD_HOLD_MS = 8_000;
// Left alone this long with nothing happening, the assistant dozes off until the visitor moves.
export const DOZE_AFTER_MS = 60_000;

/** What the assistant is doing right now, from the mic, its voice and the answer stream. */
export function botState(input: { listening: boolean; speaking: boolean; search: AskViewState; asleep: boolean }): BotState {
  const { listening, speaking, search, asleep } = input;
  if (listening) return "listening";
  if (speaking) return "speaking";
  if (search.status === "thinking") return "thinking";
  if (search.status === "streaming") return search.searching ? "searching" : search.reply ? "speaking" : "thinking";
  if (search.status === "error") return "error";
  return asleep ? "sleeping" : "idle";
}

/** The reply's own mood, or one read from how the search went when the model gave none. */
export function moodOf(search: AskViewState): AskMood | null {
  if (search.mood) return search.mood;
  if (search.status !== "done" || search.layout === null) return null;
  if (search.cards.length === 0) return "sorry";
  return search.relaxed.length > 0 ? "curious" : "happy";
}

function useAsleep(quiet: boolean): boolean {
  const [asleep, setAsleep] = useState(false);
  useEffect(() => {
    if (!quiet) return;
    let timer = window.setTimeout(() => setAsleep(true), DOZE_AFTER_MS);
    const wake = () => {
      setAsleep(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAsleep(true), DOZE_AFTER_MS);
    };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      setAsleep(false);
    };
  }, [quiet]);
  return quiet && asleep;
}

function useFadingMood(mood: AskMood | null, holding: boolean): AskMood | null {
  const [faded, setFaded] = useState<AskMood | null>(null);
  useEffect(() => {
    if (holding || mood === null) return;
    const timer = window.setTimeout(() => setFaded(mood), MOOD_HOLD_MS);
    return () => { window.clearTimeout(timer); setFaded(null); };
  }, [holding, mood]);
  return faded === mood ? null : mood;
}

/** The orb's state and mood: work states first, a mood that fades once it has been shown, dozing when left alone. */
export function useBotFace(listening: boolean, speaking: boolean, search: AskViewState): { state: BotState; mood: AskMood | null } {
  const awake = botState({ listening, speaking, search, asleep: false });
  const asleep = useAsleep(awake === "idle");
  const mood = useFadingMood(moodOf(search), awake === "speaking");
  return { state: asleep ? "sleeping" : awake, mood };
}
