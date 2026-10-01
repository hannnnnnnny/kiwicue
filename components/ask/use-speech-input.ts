"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
export type SpeechRecognitionConstructor = new () => Recognition;

/** How long the visitor can pause before their turn is sent. */
export const SILENCE_MS = 2_000;

// The Web Speech API is not in TypeScript's DOM lib and ships prefixed in Chrome and Safari.
export function speechRecognitionConstructor(scope: object = typeof window === "undefined" ? {} : window): SpeechRecognitionConstructor | null {
  const record = scope as Record<string, unknown>;
  const candidate = record.SpeechRecognition ?? record.webkitSpeechRecognition;
  return typeof candidate === "function" ? candidate as SpeechRecognitionConstructor : null;
}

function transcriptOf(results: SpeechResultList): string {
  return Array.from({ length: results.length }, (_, index) => results[index][0]?.transcript ?? "").join("").trim();
}

const subscribeNever = () => () => undefined;

export function useSpeechInput({ language, onFinal }: { language: "en" | "zh"; onFinal(text: string): void }) {
  const supported = useSyncExternalStore(subscribeNever, () => speechRecognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<"denied" | "failed" | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const heard = useRef("");
  const delivered = useRef(false);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalHandler = useRef(onFinal);
  useEffect(() => { finalHandler.current = onFinal; }, [onFinal]);


  // Hands the utterance over exactly once, however the session ends (silence, tap or browser).
  const deliver = useCallback(() => {
    if (silence.current) clearTimeout(silence.current);
    if (delivered.current) return;
    delivered.current = true;
    setInterim("");
    setListening(false);
    if (heard.current) finalHandler.current(heard.current);
    recognition.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    delivered.current = true;
    heard.current = "";
    if (silence.current) clearTimeout(silence.current);
    const previous = recognition.current;
    recognition.current = null;
    previous?.abort();
    setListening(false);
    setInterim("");
  }, []);
  const start = useCallback(() => {
    const Constructor = speechRecognitionConstructor();
    if (!Constructor) return;
    cancel();
    const instance = new Constructor();
    instance.lang = language === "zh" ? "zh-CN" : "en-NZ";
    instance.interimResults = true;
    instance.continuous = true;
    const current = () => recognition.current === instance && !delivered.current;
    instance.onresult = (event) => {
      if (!current()) return;
      heard.current = transcriptOf(event.results);
      setInterim(heard.current);
      if (silence.current) clearTimeout(silence.current);
      silence.current = setTimeout(deliver, SILENCE_MS);
    };
    instance.onerror = (event) => {
      if (!current()) return;
      cancel();
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "failed");
    };
    instance.onend = () => { if (current()) deliver(); };
    recognition.current = instance;
    heard.current = "";
    delivered.current = false;
    setError(null);
    setListening(true);
    try { instance.start(); }
    catch (failure) {
      cancel();
      setError(failure instanceof DOMException && failure.name === "NotAllowedError" ? "denied" : "failed");
    }
  }, [cancel, deliver, language]);

  useEffect(() => () => {
    delivered.current = true;
    if (silence.current) clearTimeout(silence.current);
    const previous = recognition.current;
    recognition.current = null;
    previous?.abort();
  }, []);

  return { supported, listening, interim, error, start, stop: deliver, cancel };
}
