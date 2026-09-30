"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLanguage } from "../language-provider";
import { AskResultCard } from "./ask-result-card";
import { useAskStream, type AskViewState } from "./use-ask-stream";
import { useSpeechInput } from "./use-speech-input";

type Language = "en" | "zh";
const copy = {
  en: {
    title: "Ask KiwiCue", placeholder: "Ask anything", hint: "Try “Something with the kids this Saturday near Botany”",
    send: "Ask", close: "Close", speak: "Start speaking", stopSpeaking: "Stop listening", listening: "Listening…",
    noVoice: "Voice isn't supported in this browser. Type your question instead.", denied: "Microphone access was blocked. You can type instead.",
    thinking: "Finding the best options…", empty: "Nothing matched. Try removing a filter or asking more broadly.",
    remove: (label: string) => `Remove ${label}`, left: (count: number) => `${count} free questions left today`, signIn: "Sign in",
    readAloud: "Read replies aloud", privacy: "Questions are processed by TypeSafe AI (US) and DeepSeek (China). No account details or location are sent.",
  },
  zh: {
    title: "问问 KiwiCue", placeholder: "想去哪、想看什么，直接问", hint: "试试“这周六带孩子，Botany 附近”",
    send: "提问", close: "关闭", speak: "开始说话", stopSpeaking: "停止收听", listening: "正在听…",
    noVoice: "当前浏览器不支持语音，请直接输入问题。", denied: "麦克风权限被拒绝，可以改为打字。",
    thinking: "正在找最合适的…", empty: "没有找到匹配的结果，试试去掉一个条件或换个问法。",
    remove: (label: string) => `移除 ${label}`, left: (count: number) => `今天还剩 ${count} 次免费提问`, signIn: "登录",
    readAloud: "朗读回复", privacy: "问题会由 TypeSafe AI（美国）和 DeepSeek（中国）处理，不会发送账号信息或位置。",
  },
} as const;
const SPEAK_KEY = "kiwicue.ask.speak";

function readSpeakPreference(): boolean {
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false; // Storage can be blocked; reading aloud simply stays off.
  }
}

function writeSpeakPreference(value: boolean): void {
  try {
    localStorage.setItem(SPEAK_KEY, value ? "1" : "0");
  } catch (error) {
    if (!(error instanceof DOMException)) throw error; // Blocked storage only loses the remembered toggle.
  }
}

function useSpokenReply(reply: string, done: boolean, enabled: boolean, language: Language) {
  useEffect(() => {
    if (!done || !enabled || !reply || typeof speechSynthesis === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = language === "zh" ? "zh-CN" : "en-NZ";
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    return () => speechSynthesis.cancel();
  }, [done, enabled, language, reply]);
}

function trapFocus(event: KeyboardEvent<HTMLDivElement>, onClose: () => void) {
  if (event.key === "Escape") { onClose(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input")];
  if (focusable.length === 0) return;
  const [first, last] = [focusable[0], focusable[focusable.length - 1]];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function MicIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" fill="currentColor" /></svg>;
}

function AskInput({ language, onAsk }: { language: Language; onAsk(text: string): void }) {
  const content = copy[language];
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const speech = useSpeechInput({ language, onFinal: (spoken) => { setText(spoken); onAsk(spoken); } });
  useEffect(() => { input.current?.focus(); }, []);
  function submit(event: FormEvent) { event.preventDefault(); if (text.trim()) onAsk(text.trim()); }
  const hint = speech.listening ? content.listening : !speech.supported ? content.noVoice : speech.error === "denied" ? content.denied : content.hint;
  return (
    <form role="search" className="ask-input" onSubmit={submit}>
      {speech.supported ? (
        <button type="button" className="ask-mic" data-listening={speech.listening || undefined}
          aria-label={speech.listening ? content.stopSpeaking : content.speak} onClick={speech.listening ? speech.stop : speech.start}>
          <MicIcon />
        </button>
      ) : null}
      <input ref={input} aria-label={content.placeholder} placeholder={content.placeholder} maxLength={300}
        value={speech.listening && speech.interim ? speech.interim : text} onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="ask-send">{content.send}</button>
      <p className="ask-input-hint" aria-live="polite">{hint}</p>
    </form>
  );
}

function AskChips({ state, language, onRemove }: { state: AskViewState; language: Language; onRemove(key: string): void }) {
  if (state.chips.length === 0) return null;
  return <ul className="ask-chips">{state.chips.map((chip) => (
    <li key={chip.key}>
      <button type="button" aria-label={copy[language].remove(chip.label)} onClick={() => onRemove(chip.key)}>{chip.label}<span aria-hidden="true"> ×</span></button>
    </li>
  ))}</ul>;
}

function AskResults({ state, language, onRemoveChip }: { state: AskViewState; language: Language; onRemoveChip(key: string): void }) {
  const content = copy[language];
  const best = state.cards.find((card) => card.id === state.bestId) ?? null;
  const others = state.cards.filter((card) => card !== best);
  return (
    <div className="ask-results" aria-live="polite">
      <AskChips state={state} language={language} onRemove={onRemoveChip} />
      {state.reply ? <p className="ask-reply">{state.reply}</p> : null}
      {state.notices.map((notice) => <p key={notice} className="ask-notice" role="status">{notice}</p>)}
      {state.status === "thinking" ? <div className="ask-skeleton" role="status" aria-label={content.thinking}><span /><span /><span /></div> : null}
      {best ? <AskResultCard card={best} best language={language} /> : null}
      {others.length > 0 ? <ol className="ask-list">{others.map((card, index) => (
        <li key={card.id} style={{ animationDelay: `${Math.min(index, 12) * 80}ms` }}><AskResultCard card={card} best={false} language={language} /></li>
      ))}</ol> : null}
      {state.status === "done" && state.cards.length === 0 ? <p className="ask-empty">{content.empty}</p> : null}
    </div>
  );
}

function AskError({ error, language }: { error: NonNullable<AskViewState["error"]>; language: Language }) {
  return (
    <div className="ask-error" role="alert">
      <p>{error.message}</p>
      {error.code === "quota_exhausted" ? <Link href="/login">{copy[language].signIn}</Link> : null}
    </div>
  );
}

export function AskOverlay({ onClose, fetchImpl }: { onClose(): void; fetchImpl?: typeof fetch }) {
  const { language } = useLanguage();
  const content = copy[language];
  const { state, ask, removeChip } = useAskStream(fetchImpl);
  const [speak, setSpeak] = useState(readSpeakPreference);
  useSpokenReply(state.reply, state.status === "done", speak, language);
  function toggleSpeak(value: boolean) { setSpeak(value); writeSpeakPreference(value); }
  return (
    <div className="ask-overlay" role="dialog" aria-modal="true" aria-labelledby="ask-title" onKeyDown={(event) => trapFocus(event, onClose)}>
      <div className="ask-panel">
        <header className="ask-header">
          <h2 id="ask-title">{content.title}</h2>
          <label className="ask-speak-toggle"><input type="checkbox" checked={speak} onChange={(event) => toggleSpeak(event.target.checked)} />{content.readAloud}</label>
          <button type="button" className="ask-close" aria-label={content.close} onClick={onClose}>×</button>
        </header>
        <AskInput language={language} onAsk={(text) => void ask(text, language)} />
        {state.error
          ? <AskError error={state.error} language={language} />
          : <AskResults state={state} language={language} onRemoveChip={(key) => void removeChip(key, language)} />}
        <footer className="ask-footer">
          {state.remaining !== null ? <span>{content.left(state.remaining)}</span> : null}
          <small>{content.privacy}</small>
        </footer>
      </div>
    </div>
  );
}
