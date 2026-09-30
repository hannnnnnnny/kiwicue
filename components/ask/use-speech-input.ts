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

// The Web Speech API is not in TypeScript's DOM lib and ships prefixed in Chrome and Safari.
export function speechRecognitionConstructor(scope: object = typeof window === "undefined" ? {} : window): SpeechRecognitionConstructor | null {
  const record = scope as Record<string, unknown>;
  const candidate = record.SpeechRecognition ?? record.webkitSpeechRecognition;
  return typeof candidate === "function" ? candidate as SpeechRecognitionConstructor : null;
}

const subscribeNever = () => () => undefined;

export function useSpeechInput({ language, onFinal }: { language: "en" | "zh"; onFinal(text: string): void }) {
  const supported = useSyncExternalStore(subscribeNever, () => speechRecognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<"denied" | "failed" | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const finalHandler = useRef(onFinal);
  useEffect(() => { finalHandler.current = onFinal; }, [onFinal]);
  useEffect(() => () => recognition.current?.abort(), []);

  const start = useCallback(() => {
    const Constructor = speechRecognitionConstructor();
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = language === "zh" ? "zh-CN" : "en-NZ";
    instance.interimResults = true;
    instance.continuous = false;
    instance.onresult = (event) => {
      const latest = event.results[event.results.length - 1];
      const transcript = latest[0]?.transcript.trim() ?? "";
      if (!latest.isFinal) { setInterim(transcript); return; }
      setInterim("");
      if (transcript) finalHandler.current(transcript);
    };
    instance.onerror = (event) => setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : "failed");
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setError(null);
    setListening(true);
    instance.start();
  }, [language]);

  const stop = useCallback(() => recognition.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}
