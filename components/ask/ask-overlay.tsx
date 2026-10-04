"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AskMood } from "../../lib/ask/mood";
import { ASSISTANTS, type Assistant, type AssistantId } from "../../lib/assistants";
import { useLanguage } from "../language-provider";
import { useAssistant } from "../use-assistant";
import { AssistantOrb, type BotState } from "./assistant-orb";
import { AssistantPicker } from "./assistant-picker";
import { AskResults } from "./ask-results";
import { plainText, RichText } from "./rich-text";
import { useAskChat, type ChatEntry } from "./use-ask-chat";
import { useAskStream, type AskViewState } from "./use-ask-stream";
import { useBotFace } from "./use-bot-face";
import { useSpeechInput } from "./use-speech-input";
import { languageOf, readVoiceLanguage, writeVoiceLanguage, type SpokenLanguage } from "./spoken-language";
import { createBrowserVoice, type Tone } from "./voice";

type Language = "en" | "zh";
const copy = {
  en: {
    status: { idle: "Ask me anything", listening: "Listening…", thinking: "Thinking…", searching: "Looking through listings…", speaking: "Speaking…", error: "Something went wrong", sleeping: "Dozing — say something to wake me" },
    mute: (name: string) => `Mute ${name}`, unmute: (name: string) => `Unmute ${name}`, close: "Close",
    message: (name: string) => `Message ${name}`, placeholder: "Type or tap the mic", change: "Change assistant", newChat: "New chat",
    send: "Send", talk: (name: string) => `Talk to ${name}`, stopTalking: "Stop and send", noVoice: "Voice isn't supported in this browser. Type instead.",
    voiceLanguage: { en: "Voice input: English. Switch to Chinese", zh: "Voice input: Chinese. Switch to English" },
    denied: "Microphone access was blocked. You can type instead.", left: (count: number) => `${count} free searches left today`,
    earlier: (count: number, labels: string) => `Earlier · ${count} ${count === 1 ? "result" : "results"}${labels ? ` · ${labels}` : ""}`,
    privacy: "Questions are processed by TypeSafe AI (US) and DeepSeek (China). No account details or location are sent.",
  },
  zh: {
    status: { idle: "有什么想问的", listening: "正在听…", thinking: "正在想…", searching: "正在翻找活动…", speaking: "正在说…", error: "出了点问题", sleeping: "打盹中，说句话叫醒我" },
    mute: (name: string) => `${name} 静音`, unmute: (name: string) => `${name} 取消静音`, close: "关闭",
    message: (name: string) => `发给 ${name}`, placeholder: "打字，或点麦克风说话", change: "换个助手", newChat: "新对话",
    send: "发送", talk: (name: string) => `和 ${name} 说话`, stopTalking: "说完了，发送", noVoice: "当前浏览器不支持语音，请直接打字。",
    voiceLanguage: { en: "语音输入：英文，点按切换到中文", zh: "语音输入：中文，点按切换到英文" },
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

/** The line the assistant should say now: its newest message, or its finished reply, read without formatting. */
function currentLine(entries: ChatEntry[], search: AskViewState): Line {
  const latest = entries[entries.length - 1];
  if (latest?.role === "assistant") return { key: latest.id, text: latest.text };
  if (latest?.role === "results" && search.status === "done" && search.reply.trim()) return { key: latest.id, text: plainText(search.reply) };
  return null;
}

/** Speaks each new line once; when it finishes, `onSpoken` lets a voice conversation listen again. */
function useAssistantVoice(line: Line, muted: boolean, tone: Tone, onSpoken: () => void): { speaking: boolean; silence(): void } {
  const voice = useMemo(() => createBrowserVoice(), []);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const spoken = useRef(new Set<string>());
  const afterSpeech = useRef(onSpoken);
  const currentTone = useRef(tone);
  useEffect(() => { afterSpeech.current = onSpoken; currentTone.current = tone; }, [onSpoken, tone]);
  useEffect(() => () => voice.cancel(), [voice]);
  useEffect(() => { if (muted) voice.cancel(); }, [muted, voice]);
  useEffect(() => {
    if (!line || muted || !voice.available || spoken.current.has(line.key)) return;
    spoken.current.add(line.key);
    void (async () => {
      setSpeakingKey(line.key);
      // Speak each line in its own language: a Chinese reply on the English site still gets a Chinese voice.
      await voice.speak(line.text, languageOf(line.text), currentTone.current);
      setSpeakingKey((current) => current === line.key ? null : current);
      afterSpeech.current();
    })();
  }, [line, muted, voice]);
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
  onQuickReply(text: string): void; onRemoveChip(key: string): void; onSound(): void;
};

function stateOf(entry: ChatEntry, live: AskViewState): AskViewState | null {
  return entry.role === "results" ? entry.snapshot ?? live : null;
}

/** One answer: what it found (folded once newer cards replace it), then what the assistant said. */
function Answer({ state, live, folded, language, onRemoveChip, onSound }: {
  state: AskViewState; live: boolean; folded: boolean; language: Language; onRemoveChip(key: string): void; onSound(): void;
}) {
  const typing = live && !state.reply && !state.error && (state.status === "thinking" || (state.status === "streaming" && state.chips.length === 0));
  return (
    <>
      {state.cards.length > 0 || state.chips.length > 0 || state.error || state.notices.length > 0 ? (
        <div className="ask-msg" data-from="kiwi" data-kind="results">
          {folded
            ? <Earlier snapshot={state} language={language} onSound={onSound} />
            : <AskResults state={state} language={language} onRemoveChip={live ? onRemoveChip : undefined} onSound={onSound} />}
        </div>
      ) : null}
      {state.reply.trim() ? <div className="ask-msg" data-from="kiwi" data-kind="reply"><RichText text={state.reply} /></div> : null}
      {typing ? <div className="ask-msg ask-typing" data-from="kiwi" aria-hidden="true"><span /><span /><span /></div> : null}
    </>
  );
}

function Thread({ entries, search, busy, language, onQuickReply, onRemoveChip, onSound }: ThreadProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" }); }, [entries.length, search.cards.length, search.reply]);
  const latest = entries.length - 1;
  return (
    <div className="ask-thread" aria-live="polite">
      {entries.map((entry, index) => {
        if (entry.role === "results") {
          const state = entry.snapshot ?? search;
          // Earlier cards fold away only once a later answer has cards of its own.
          const folded = entries.slice(index + 1).some((later) => (stateOf(later, search)?.cards.length ?? 0) > 0);
          return <Answer key={entry.id} state={state} live={!entry.snapshot} folded={folded}
            language={language} onRemoveChip={onRemoveChip} onSound={onSound} />;
        }
        return <Message key={entry.id} entry={entry} quick={index === latest && !busy} language={language} onQuickReply={onQuickReply} />;
      })}
      <div ref={end} />
    </div>
  );
}

type Speech = ReturnType<typeof useSpeechInput>;

type ComposerProps = {
  language: Language; name: string; speech: Speech; voiceLanguage: SpokenLanguage; onVoiceLanguage(next: SpokenLanguage): void; onSend(text: string): void;
};

function Composer({ language, name, speech, voiceLanguage, onVoiceLanguage, onSend }: ComposerProps) {
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
    <form className="ask-composer" aria-label={content.message(name)} onSubmit={submit}>
      {speech.supported ? (
        <button type="button" className="ask-mic" data-listening={speech.listening || undefined}
          aria-label={speech.listening ? content.stopTalking : content.talk(name)} onClick={speech.listening ? speech.stop : speech.start}>
          <MicIcon />
        </button>
      ) : null}
      {speech.supported ? (
        <button type="button" className="ask-voice-lang" aria-label={content.voiceLanguage[voiceLanguage]}
          onClick={() => onVoiceLanguage(voiceLanguage === "zh" ? "en" : "zh")} disabled={speech.listening}>
          {voiceLanguage === "zh" ? "中" : "EN"}
        </button>
      ) : null}
      <input ref={input} aria-label={content.message(name)} placeholder={content.placeholder} maxLength={300}
        value={speech.listening && speech.interim ? speech.interim : text} onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="ask-send">{content.send}</button>
      {hint ? <p className="ask-input-hint" aria-live="polite">{hint}</p> : null}
    </form>
  );
}

type HeaderProps = {
  assistant: Assistant; state: BotState; mood: AskMood | null; language: Language; muted: boolean; picking: boolean;
  onPickToggle(): void; onMute(): void; onRestart(): void; onClose(): void;
};

function AssistantHeader({ assistant, state, mood, language, muted, picking, onPickToggle, onMute, onRestart, onClose }: HeaderProps) {
  const content = copy[language];
  return (
    <header className="ask-header">
      <button type="button" className="ask-orb-button" aria-label={content.change} aria-expanded={picking} onClick={onPickToggle}>
        <AssistantOrb assistant={assistant} state={state} mood={mood} />
      </button>
      <div className="ask-header-text">
        <h2 id="ask-title">{assistant.name}</h2>
        <p role="status">{content.status[state]}</p>
      </div>
      <button type="button" className="ask-mute" aria-pressed={muted} aria-label={muted ? content.unmute(assistant.name) : content.mute(assistant.name)} onClick={onMute}>{muted ? "🔇" : "🔊"}</button>
      <button type="button" className="ask-new" onClick={onRestart}>{content.newChat}</button>
      <button type="button" className="ask-close" aria-label={content.close} onClick={onClose}>×</button>
    </header>
  );
}

export function AskOverlay({ onClose, fetchImpl }: { onClose(): void; fetchImpl?: typeof fetch }) {
  const { language } = useLanguage();
  const content = copy[language];
  const { assistant, setAssistant } = useAssistant();
  const [picking, setPicking] = useState(false);
  const search = useAskStream(fetchImpl, assistant.id);
  const chat = useAskChat({ language, name: assistant.name, searchState: search.state, search: (text, context) => void search.ask(text, language, context), reset: search.reset });
  // The mic listens in the language the visitor talks in, which may differ from the site's.
  const [voiceLanguage, setVoiceLanguage] = useState<SpokenLanguage>(() => readVoiceLanguage() ?? language);
  const chooseVoiceLanguage = (next: SpokenLanguage) => { setVoiceLanguage(next); writeVoiceLanguage(next); };
  const speech = useSpeechInput({ language: voiceLanguage, onFinal: (text) => chat.send(text, "voice") });
  const [muted, setMuted] = useState(readMuted);
  const line = currentLine(chat.entries, search.state);
  const { speaking, silence } = useAssistantVoice(line, muted, assistant.voice, () => { if (chat.lastInput === "voice" && speech.supported) speech.start(); });
  const busy = search.state.status === "thinking" || search.state.status === "streaming";
  const { state, mood } = useBotFace(speech.listening, speaking, search.state);
  const { remaining } = search.state;
  // Quick replies disappear once used, which drops focus outside the dialog, so Escape
  // is handled for the whole document while the overlay is open.
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  function toggleMute() { setMuted(!muted); writeMuted(!muted); }
  function pick(id: AssistantId) {
    setPicking(false);
    if (id === assistant.id) return;
    setAssistant(id);
    chat.introduce(ASSISTANTS[id].name);
  }
  return (
    <div className="ask-overlay" role="dialog" aria-modal="true" aria-labelledby="ask-title" onKeyDown={trapFocus}>
      <div className="ask-panel">
        <div className="ask-top">
          <AssistantHeader assistant={assistant} state={state} mood={mood} language={language} muted={muted} picking={picking}
            onPickToggle={() => setPicking(!picking)} onMute={toggleMute} onRestart={chat.restart} onClose={onClose} />
          {picking ? <AssistantPicker current={assistant} language={language} onPick={pick} /> : null}
        </div>
        <Thread entries={chat.entries} search={search.state} busy={busy} language={language}
          onQuickReply={(text) => chat.send(text, "text")} onRemoveChip={(key) => void search.removeChip(key, language)} onSound={silence} />
        <Composer language={language} name={assistant.name} speech={speech} voiceLanguage={voiceLanguage} onVoiceLanguage={chooseVoiceLanguage}
          onSend={(text) => { if (languageOf(text) !== voiceLanguage) chooseVoiceLanguage(languageOf(text)); chat.send(text, "text"); }} />
        <footer className="ask-footer">
          {remaining !== null ? <span>{content.left(remaining)}</span> : null}
          <small>{content.privacy}</small>
        </footer>
      </div>
    </div>
  );
}
