import { describe, expect, it, vi } from "vitest";
import { createBrowserVoice, pickVoice } from "../components/ask/voice";

const voices = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Google US English", lang: "en-US" },
  { name: "Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)", lang: "zh-CN" },
  { name: "Microsoft HsiaoChen - Chinese (Taiwan)", lang: "zh-TW" },
  { name: "Microsoft Huihui - Chinese (Simplified, PRC)", lang: "zh-CN" },
  { name: "Karen", lang: "en-AU" },
];

class FakeUtterance {
  lang = ""; voice: unknown = null; rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

describe("pickVoice", () => {
  it("prefers natural-sounding voices in the right language", () => {
    expect(pickVoice(voices, "zh")?.name).toContain("Xiaoxiao");
    expect(pickVoice(voices, "en")?.name).toBe("Google US English");
    expect(pickVoice([{ name: "Kyoko", lang: "ja-JP" }], "en")).toBeNull();
  });
});

describe("createBrowserVoice", () => {
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

  it("resolves on errors and is unavailable without speech synthesis", async () => {
    const synth = { getVoices: () => [], cancel: vi.fn(), speak: vi.fn((utterance: FakeUtterance) => utterance.onerror?.()) };
    await expect(createBrowserVoice(synth, FakeUtterance).speak("hi", "en")).resolves.toBeUndefined();
    const missing = createBrowserVoice(undefined, undefined);
    expect(missing.available).toBe(false);
    await expect(missing.speak("hi", "en")).resolves.toBeUndefined();
  });
});
