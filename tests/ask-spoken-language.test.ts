import { afterEach, describe, expect, it } from "vitest";
import { languageOf, readVoiceLanguage, writeVoiceLanguage } from "../components/ask/spoken-language";

afterEach(() => localStorage.clear());

describe("languageOf", () => {
  it("hears Chinese in Chinese text, even with English names mixed in", () => {
    expect(languageOf("周末想带两个小朋友出去玩")).toBe("zh");
    expect(languageOf("这个周末有 Kitchen Chaos! 和 Bundle Baby 两场")).toBe("zh");
    expect(languageOf("Any live music this weekend?")).toBe("en");
    expect(languageOf("Try Café 黑")).toBe("en");
    expect(languageOf("")).toBe("en");
  });
});

describe("voice language memory", () => {
  it("remembers an explicit choice and ignores anything else", () => {
    expect(readVoiceLanguage()).toBeNull();
    writeVoiceLanguage("zh");
    expect(readVoiceLanguage()).toBe("zh");
    localStorage.setItem("kiwicue.ask.voiceLanguage", "fr");
    expect(readVoiceLanguage()).toBeNull();
  });
});
