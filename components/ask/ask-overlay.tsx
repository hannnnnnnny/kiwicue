"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useLanguage } from "../language-provider";
import { AskBot, type BotState } from "./ask-bot";
import { AskResults } from "./ask-results";
import type { FollowUpOption } from "./follow-up";
import { useAskChat, type ChatEntry } from "./use-ask-chat";
import { useAskStream, type AskViewState } from "./use-ask-stream";
import { useSpeechInput } from "./use-speech-input";
import { createBrowserVoice } from "./voice";

type Language = "en" | "zh";
const copy = {
  en: {
    title: "Kiwi", status: { idle: "Ask me anything", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" },
    mute: "Mute Kiwi", unmute: "Unmute Kiwi", close: "Close", message: "Message Kiwi", placeholder: "Type or tap the mic",
    send: "Send", talk: "Talk to Kiwi", stopTalking: "Stop and send", noVoice: "Voice isn't supported in this browser. Type instead.",
    denied: "Microphone access was blocked. You can type instead.", left: (count: number) => `${count} free searches left today`,
    earlier: (count: number, labels: string) => `Earlier · ${count} ${count === 1 ? "result" : "results"}${labels ? ` · ${labels}` : ""}`,
    privacy: "Questions are processed by TypeSafe AI (US) and DeepSeek (China). No account details or location are sent.",
  },
  zh: {
    title: "Kiwi", status: { idle: "有什么想问的", listening: "正在听…", thinking: "正在想…", speaking: "正在说…" },
    mute: "Kiwi 静音", unmute: "取消静音", close: "关闭", message: "发给 Kiwi", placeholder: "打字，或点麦克风说话",
    send: "发送", talk: "和 Kiwi 说话", stopTalking: "说完了，发送", noVoice: "当前浏览器不支持语音，请直接打字。",
    denied: "麦克风权限被拒绝，可以改为打字。", left: (count: number) => `今天还剩 ${count} 次免费搜索`,
    earlier: (count: number, labels: string) => `之前 · ${count} 个结果${labels ? ` · ${labels}` : ""}`,
    privacy: "问题会由 TypeSafe AI（美国）和 DeepSeek（中国）处理，不会发送账号信息或位置。",
  },
} as const;
const MUTED_KEY = "kiwicue.ask.muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false; // Blocked storage just means Kiwi starts unmuted.
  }
}

function writeMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, value ? "1" : "0");
  } catch (error) {
    if (!(error instanceof DOMException)) throw error; // Blocked storage only loses the remembered choice.
  }
}

function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
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

type Line = { key: string; text: string } | null;

/** The line Kiwi should say now: its newest message, or a finished search's reply and follow-up question. */
function currentLine(entries: ChatEntry[], search: AskViewState): Line {
  const latest = entries[entries.length - 1];
  if (latest?.role === "assistant") return { key: latest.id, text: latest.text };
  if (latest?.role === "followup") return { key: latest.id, text: search.reply ? `${search.reply} ${latest.text}` : latest.text };
  if (latest?.role === "results" && search.status === "done" && search.reply) return { key: latest.id, text: search.reply };
  return null;
}

/** Speaks each new line once; when it finishes, `onSpoken` lets a voice conversation listen again. */
function useKiwiVoice(line: Line, muted: boolean, language: Language, onSpoken: () => void): { speaking: boolean; silence(): void } {
  const voice = useMemo(() => createBrowserVoice(), []);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const spoken = useRef(new Set<string>());
  const afterSpeech = useRef(onSpoken);
  useEffect(() => { afterSpeech.current = onSpoken; }, [onSpoken]);
  useEffect(() => () => voice.cancel(), [voice]);
  useEffect(() => { if (muted) voice.cancel(); }, [muted, voice]);
  useEffect(() => {
    if (!line || muted || !voice.available || spoken.current.has(line.key)) return;
    spoken.current.add(line.key);
    void (async () => {
      setSpeakingKey(line.key);
      await voice.speak(line.text, language);
      setSpeakingKey((current) => current === line.key ? null : current);
      afterSpeech.current();
    })();
  }, [language, line, muted, voice]);
  const silence = useCallback(() => voice.cancel(), [voice]);
  return { speaking: speakingKey !== null, silence };
}

function Message({ entry, quick, language, onQuickReply }: { entry: Extract<ChatEntry, { role: "assistant" | "user" }>; quick: boolean; language: Language; onQuickReply(text: string): void }) {
  return (
    <div className="ask-msg" data-from={entry.role === "user" ? "you" : "kiwi"}>
      <p lang={language === "zh" ? "zh-CN" : "en-NZ"}>{entry.text}</p>
      {entry.role === "assistant" && quick && entry.quickReplies.length > 0 ? (
        <div className="ask-quick">{entry.quickReplies.map((reply) => <button key={reply} type="button" onClick={() => onQuickReply(reply)}>{reply}</button>)}</div>
      ) : null}
    </div>
  );
}

function FollowUpMessage({ entry, active, onFollowUp }: { entry: Extract<ChatEntry, { role: "followup" }>; active: boolean; onFollowUp(option: FollowUpOption): void }) {
  return (
    <div className="ask-msg" data-from="kiwi">
      <p>{entry.text}</p>
      {active ? (
        <div className="ask-quick">{entry.options.map((option) => (
          <button key={option.label} type="button" data-kind={option.kind} onClick={() => onFollowUp(option)}>{option.label}</button>
        ))}</div>
      ) : null}
    </div>
  );
}

function Earlier({ snapshot, language, onSound }: { snapshot: AskViewState; language: Language; onSound(): void }) {
  const labels = snapshot.chips.map((chip) => chip.label).join(" · ");
  // Rendered only when opened, so a folded trailer never keeps playing out of sight.
  const [open, setOpen] = useState(false);
  return (
    <details className="ask-earlier" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{copy[language].earlier(snapshot.cards.length, labels)}</summary>
      {open ? <AskResults state={snapshot} language={language} onSound={onSound} /> : null}
    </details>
  );
}

type ThreadProps = {
  entries: ChatEntry[]; search: AskViewState; busy: boolean; language: Language;
  onQuickReply(text: string): void; onRemoveChip(key: string): void; onFollowUp(option: FollowUpOption): void; onSound(): void;
};

function Thread({ entries, search, busy, language, onQuickReply, onRemoveChip, onFollowUp, onSound }: ThreadProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }); }, [entries.length, search.cards.length, search.reply]);
  const latest = entries.length - 1;
  return (
    <div className="ask-thread" aria-live="polite">
      {entries.map((entry, index) => {
        if (entry.role === "followup") return <FollowUpMessage key={entry.id} entry={entry} active={index === latest && !busy} onFollowUp={onFollowUp} />;
        if (entry.role === "results") {
          return <div key={entry.id} className="ask-msg" data-from="kiwi" data-kind="results">
            {entry.snapshot
              ? <Earlier snapshot={entry.snapshot} language={language} onSound={onSound} />
              : <AskResults state={search} language={language} onRemoveChip={onRemoveChip} onSound={onSound} />}
          </div>;
        }
        return <Message key={entry.id} entry={entry} quick={index === latest && !busy} language={language} onQuickReply={onQuickReply} />;
      })}
      <div ref={end} />
    </div>
  );
}

type Speech = ReturnType<typeof useSpeechInput>;

function Composer({ language, speech, onSend }: { language: Language; speech: Speech; onSend(text: string): void }) {
  const content = copy[language];
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }
  const hint = speech.listening ? content.status.listening : !speech.supported ? content.noVoice : speech.error === "denied" ? content.denied : null;
  return (
    <form className="ask-composer" aria-label={content.message} onSubmit={submit}>
      {speech.supported ? (
        <button type="button" className="ask-mic" data-listening={speech.listening || undefined}
          aria-label={speech.listening ? content.stopTalking : content.talk} onClick={speech.listening ? speech.stop : speech.start}>
          <MicIcon />
        </button>
      ) : null}
      <input ref={input} aria-label={content.message} placeholder={content.placeholder} maxLength={300}
        value={speech.listening && speech.interim ? speech.interim : text} onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="ask-send">{content.send}</button>
      {hint ? <p className="ask-input-hint" aria-live="polite">{hint}</p> : null}
    </form>
  );
}

function botState(listening: boolean, speaking: boolean, busy: boolean): BotState {
  if (listening) return "listening";
  if (speaking) return "speaking";
  return busy ? "thinking" : "idle";
}

export function AskOverlay({ onClose, fetchImpl }: { onClose(): void; fetchImpl?: typeof fetch }) {
  const { language } = useLanguage();
  const content = copy[language];
  const search = useAskStream(fetchImpl);
  const chat = useAskChat({ language, searchState: search.state, search: (text) => void search.ask(text, language), reset: search.reset });
  const speech = useSpeechInput({ language, onFinal: (text) => chat.send(text, "voice") });
  const [muted, setMuted] = useState(readMuted);
  const line = currentLine(chat.entries, search.state);
  const { speaking, silence } = useKiwiVoice(line, muted, language, () => { if (chat.lastInput === "voice" && speech.supported) speech.start(); });
  const busy = search.state.status === "thinking" || search.state.status === "streaming";
  const state = botState(speech.listening, speaking, busy);
  const { remaining } = search.state;
  // Quick replies disappear once used, which drops focus outside the dialog, so Escape
  // is handled for the whole document while the overlay is open.
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  function toggleMute() { setMuted(!muted); writeMuted(!muted); }
  return (
    <div className="ask-overlay" role="dialog" aria-modal="true" aria-labelledby="ask-title" onKeyDown={trapFocus}>
      <div className="ask-panel">
        <header className="ask-header">
          <AskBot state={state} />
          <div className="ask-header-text"><h2 id="ask-title">{content.title}</h2><p role="status">{content.status[state]}</p></div>
          <button type="button" className="ask-mute" aria-pressed={muted} aria-label={muted ? content.unmute : content.mute} onClick={toggleMute}>{muted ? "🔇" : "🔊"}</button>
          <button type="button" className="ask-close" aria-label={content.close} onClick={onClose}>×</button>
        </header>
        <Thread entries={chat.entries} search={search.state} busy={busy} language={language}
          onQuickReply={(text) => chat.send(text, "text")} onRemoveChip={(key) => void search.removeChip(key, language)}
          onFollowUp={chat.followUp} onSound={silence} />
        <Composer language={language} speech={speech} onSend={(text) => chat.send(text, "text")} />
        <footer className="ask-footer">
          {remaining !== null ? <span>{content.left(remaining)}</span> : null}
          <small>{content.privacy}</small>
        </footer>
      </div>
    </div>
  );
}
