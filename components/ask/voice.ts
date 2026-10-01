"use client";

type Language = "en" | "zh";
type VoiceInfo = { name: string; lang: string };
type UtteranceLike = { lang: string; voice: unknown; rate: number; pitch: number; onend: (() => void) | null; onerror: (() => void) | null };
type UtteranceConstructor = new (text: string) => UtteranceLike;
type SynthLike = { getVoices(): readonly VoiceInfo[]; speak(utterance: UtteranceLike): void; cancel(): void };

/** How an assistant sounds; see lib/assistants.ts. */
export type Tone = { pitch: number; rate: number };
/** The assistant's voice. The browser implementation can later be swapped for a cloud TTS behind this type. */
export type Voice = { available: boolean; speak(text: string, language: Language, tone?: Tone): Promise<void>; cancel(): void };
const DEFAULT_TONE: Tone = { pitch: 1, rate: 1.05 };

const NATURAL = /natural|neural|premium|enhanced|google|siri/iu;
// Some browsers never fire "end" (e.g. with no installed voice); give up after a generous estimate.
const MS_PER_CHARACTER = 90;
const END_GRACE_MS = 4_000;
const LOCALE: Record<Language, string> = { en: "en-NZ", zh: "zh-CN" };

function score(voice: VoiceInfo, language: Language): number {
  const lang = voice.lang.replace("_", "-").toLowerCase();
  const matches = language === "zh" ? lang.startsWith("zh") : lang.startsWith("en");
  if (!matches) return -1;
  const preferredRegion = language === "zh" ? lang === "zh-cn" : ["en-nz", "en-au", "en-gb"].includes(lang);
  return (NATURAL.test(voice.name) ? 4 : 0) + (preferredRegion ? 2 : 0) + (language === "zh" && lang !== "zh-cn" ? -1 : 0);
}

export function pickVoice<T extends VoiceInfo>(voices: readonly T[], language: Language): T | null {
  const ranked = voices.map((voice) => ({ voice, score: score(voice, language) })).filter(({ score: value }) => value >= 0)
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.voice ?? null;
}

function browserSynth(): SynthLike | undefined {
  return typeof window === "undefined" || !("speechSynthesis" in window) ? undefined : window.speechSynthesis as unknown as SynthLike;
}

function browserUtterance(): UtteranceConstructor | undefined {
  return typeof window === "undefined" || !("SpeechSynthesisUtterance" in window) ? undefined : window.SpeechSynthesisUtterance as unknown as UtteranceConstructor;
}

export function createBrowserVoice(synth: SynthLike | undefined = browserSynth(), Utterance: UtteranceConstructor | undefined = browserUtterance()): Voice {
  if (!synth || !Utterance) return { available: false, speak: async () => undefined, cancel: () => undefined };
  let pending: (() => void) | null = null;
  const cancel = () => { synth.cancel(); pending?.(); pending = null; };
  return {
    available: true,
    cancel,
    speak(text, language, tone = DEFAULT_TONE) {
      cancel();
      return new Promise<void>((settle) => {
        const timeout = setTimeout(() => settle(), text.length * MS_PER_CHARACTER + END_GRACE_MS);
        const resolve = () => { clearTimeout(timeout); if (pending === resolve) pending = null; settle(); };
        pending = resolve;
        const utterance = new Utterance(text);
        utterance.lang = LOCALE[language];
        utterance.voice = pickVoice(synth.getVoices(), language);
        utterance.rate = tone.rate;
        utterance.pitch = tone.pitch;
        // Errors (including a cancel) end the line quietly; the text is still on screen.
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    },
  };
}
