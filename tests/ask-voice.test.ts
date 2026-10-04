import { describe, expect, it, vi } from "vitest";
import { createBrowserVoice, pickVoice } from "../components/ask/voice";
import { ASSISTANT_IDS, ASSISTANTS } from "../lib/assistants";

const voices = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Google US English", lang: "en-US" },
  { name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN" },
  { name: "Microsoft HsiaoChen - Chinese (Taiwan)", lang: "zh-TW" },
  { name: "Microsoft Huihui - Chinese (Simplified, PRC)", lang: "zh-CN" },
  { name: "Karen", lang: "en-AU" },
];

class FakeUtterance {
  lang = ""; voice: unknown = null; rate = 1; pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

describe("pickVoice", () => {
  it.each(["en", "zh"] as const)("assigns five real %s voices rather than only varying pitch", (language) => {
    const catalog = ASSISTANT_IDS.map((id) => ({ name: `Natural ${id}`, lang: language === "zh" ? "zh-CN" : "en-NZ", voiceURI: id }));
    const selected = ASSISTANT_IDS.map((id) => pickVoice(catalog, language, ASSISTANTS[id].voice.profile)?.voiceURI);
    expect(new Set(selected).size).toBe(5);
    expect(ASSISTANT_IDS.map((id) => pickVoice([...catalog].reverse(), language, id)?.voiceURI)).toEqual(selected);
  });

  it("never hands an assistant a worse voice just to be different", () => {
    for (const id of ASSISTANT_IDS) expect(pickVoice(voices, "zh", id)?.name).toContain("Xiaoxiao");
    const english = ASSISTANT_IDS.map((id) => pickVoice(voices, "en", id)?.name);
    expect(new Set(english)).toEqual(new Set(["Google US English"]));
  });

  it("deduplicates voices and never substitutes the wrong language to create variety", () => {
    const chinese = { name: "Mandarin", lang: "zh-CN", voiceURI: "zh" };
    const catalog = [chinese, { ...chinese }, { name: "English", lang: "en-NZ" }];
    for (const id of ASSISTANT_IDS) expect(pickVoice(catalog, "zh", id)).toEqual(chinese);
    expect(pickVoice([chinese], "en", "kai")).toBeNull();
  });

  it("keeps Mandarin replies in Mandarin when Cantonese voices are also installed", () => {
    const mandarin = { name: "Mandarin", lang: "zh-CN" };
    const catalog = [mandarin, { name: "Natural Cantonese", lang: "zh-HK" }, { name: "Cantonese Hant", lang: "zh-Hant-HK" }];
    for (const id of ASSISTANT_IDS) expect(pickVoice(catalog, "zh", id)).toBe(mandarin);
  });
  it("prefers natural-sounding voices in the right language", () => {
    expect(pickVoice(voices, "zh")?.name).toContain("Xiaoxiao");
    expect(pickVoice(voices, "en")?.name).toBe("Google US English");
    expect(pickVoice([{ name: "Kyoko", lang: "ja-JP" }], "en")).toBeNull();
  });
});

describe("createBrowserVoice", () => {
  it("waits for the real voice catalog before choosing a profile", async () => {
    vi.useFakeTimers();
    try {
      let catalog: typeof voices = [];
      const listeners = new Set<() => void>();
      const spoken: FakeUtterance[] = [];
      const synth = { getVoices: () => catalog, cancel: vi.fn(), speak: (value: FakeUtterance) => spoken.push(value),
        addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
        removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); } };
      const voice = createBrowserVoice(synth, FakeUtterance);
      const done = voice.speak("你好", "zh", ASSISTANTS.rua.voice);
      expect(spoken).toHaveLength(0);
      catalog = voices;
      listeners.forEach((listener) => listener());
      expect(spoken[0].voice).toBe(pickVoice(voices, "zh", "rua"));
      spoken[0].onend?.();
      await done;
      expect(listeners.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("never starts delayed playback after a microphone tap cancels catalog loading", async () => {
    vi.useFakeTimers();
    try {
      const listeners = new Set<() => void>();
      const synth = { getVoices: () => [], cancel: vi.fn(), speak: vi.fn(),
        addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
        removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); } };
      const voice = createBrowserVoice(synth, FakeUtterance);
      const done = voice.speak("你好", "zh", ASSISTANTS.iris.voice);
      voice.cancel();
      await done;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(synth.speak).not.toHaveBeenCalled();
      expect(listeners.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("settles cancelled speech even when the browser emits no end event", async () => {
    vi.useFakeTimers();
    try {
      const voice = createBrowserVoice({ getVoices: () => [], cancel: vi.fn(), speak: vi.fn() }, FakeUtterance);
      const settled = vi.fn();
      void voice.speak("A long assistant response", "en").then(settled);
      voice.cancel();
      await Promise.resolve();
      expect(settled).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it("speaks with the picked voice and resolves when speech ends", async () => {
    const spoken: FakeUtterance[] = [];
    const synth = { getVoices: () => voices, cancel: vi.fn(), speak: vi.fn((utterance: FakeUtterance) => { spoken.push(utterance); }) };
    const voice = createBrowserVoice(synth, FakeUtterance);
    expect(voice.available).toBe(true);
    const done = voice.speak("你好", "zh");
    expect(spoken[0]).toMatchObject({ text: "你好", lang: "zh-CN" });
    expect((spoken[0].voice as { name: string }).name).toContain("Xiaoxiao");
    spoken[0].onend?.();
    await expect(done).resolves.toBeUndefined();
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("uses the assistant's pitch and rate", () => {
    const spoken: FakeUtterance[] = [];
    const voice = createBrowserVoice({ getVoices: () => voices, cancel: vi.fn(), speak: (utterance: FakeUtterance) => { spoken.push(utterance); } }, FakeUtterance);
    void voice.speak("Hi", "en", { pitch: 1.2, rate: 1.08 });
    expect(spoken[0]).toMatchObject({ pitch: 1.2, rate: 1.08 });
    void voice.speak("Hi", "en");
    expect(spoken[1]).toMatchObject({ pitch: 1, rate: 1.05 });
  });

  it("gives up waiting if the browser never reports the end of speech", async () => {
    vi.useFakeTimers();
    const synth = { getVoices: () => voices, cancel: vi.fn(), speak: vi.fn() };
    let resolved = false;
    void createBrowserVoice(synth, FakeUtterance).speak("Hi there", "en").then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it("resolves on errors and is unavailable without speech synthesis", async () => {
    const synth = { getVoices: () => [], cancel: vi.fn(), speak: vi.fn((utterance: FakeUtterance) => utterance.onerror?.()) };
    await expect(createBrowserVoice(synth, FakeUtterance).speak("hi", "en")).resolves.toBeUndefined();
    const missing = createBrowserVoice(undefined, undefined);
    expect(missing.available).toBe(false);
    await expect(missing.speak("hi", "en")).resolves.toBeUndefined();
  });
});
