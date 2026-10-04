"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A short beat after the assistant finishes before the mic reopens, so its last word isn't caught.
export const RELISTEN_MS = 400;
// Listening turns in a row with nothing said before voice chat pauses itself.
export const MAX_QUIET_TURNS = 3;

type Microphone = { listening: boolean; error: "denied" | "failed" | null; start(): void; cancel(): void };
export type VoiceEnd = "quiet" | "denied" | null;

/**
 * One tap starts a spoken conversation: listen, let the assistant answer and speak, then listen
 * again, until the visitor ends it, stays quiet for several turns, or the mic is blocked.
 * The mic is always closed while the assistant speaks so it never hears itself.
 */
export function useVoiceConversation(input: { microphone: Microphone; speaking: boolean; busy: boolean; active: boolean; silence(): void }) {
  const { microphone, speaking, busy, active, silence } = input;
  const [wanted, setWanted] = useState(false);
  const [stopped, setStopped] = useState<VoiceEnd>(null);
  const quiet = useRef(0);
  const heard = useRef(false);
  const wasListening = useRef(false);
  const { start: listen, cancel: closeMic, listening, error } = microphone;
  // A blocked mic or a hidden panel stops the conversation; the visitor restarts it with a tap.
  const blocked = error === "denied";
  const on = wanted && active && !blocked;
  const ended: VoiceEnd = wanted && blocked ? "denied" : stopped;

  const end = useCallback((reason: VoiceEnd = null) => {
    setWanted(false);
    setStopped(reason);
    closeMic();
    silence();
  }, [closeMic, silence]);

  const start = useCallback(() => {
    quiet.current = 0;
    setStopped(null);
    setWanted(true);
    listen();
  }, [listen]);

  // Called with every utterance the mic delivers, so a turn that heard something isn't counted as quiet.
  const noteHeard = useCallback(() => { heard.current = true; }, []);

  useEffect(() => {
    if (wasListening.current && !listening && on) {
      quiet.current = heard.current ? 0 : quiet.current + 1;
      if (quiet.current >= MAX_QUIET_TURNS) end("quiet");
    }
    if (listening && !wasListening.current) heard.current = false;
    wasListening.current = listening;
  }, [end, listening, on]);

  useEffect(() => {
    if (!on || listening || speaking || busy) return;
    const timer = setTimeout(listen, RELISTEN_MS);
    return () => clearTimeout(timer);
  }, [busy, listen, listening, on, speaking]);

  return { on, ended, start, end: () => end(), noteHeard };
}
