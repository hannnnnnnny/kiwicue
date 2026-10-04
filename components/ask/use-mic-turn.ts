"use client";

import { useCallback, useEffect, useRef } from "react";
import type { useSpeechInput } from "./use-speech-input";

export const MIC_COOLDOWN_MS = 300;
type Speech = ReturnType<typeof useSpeechInput>;

/** A deliberate tap starts a turn after residual speaker audio has faded. */
export function useMicTurn(speech: Speech, silence: () => void, active: boolean): Speech {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCapture = speech.cancel;
  const startCapture = speech.start;
  const cancel = useCallback(() => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
    cancelCapture();
  }, [cancelCapture]);
  useEffect(() => {
    if (!active) cancel();
    return cancel;
  }, [active, cancel]);
  const start = useCallback(() => {
    cancel();
    silence();
    if (!active) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      startCapture();
    }, MIC_COOLDOWN_MS);
  }, [active, cancel, silence, startCapture]);
  return { ...speech, start, cancel };
}
