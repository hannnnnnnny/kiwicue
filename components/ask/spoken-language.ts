import { languageOf, type TextLanguage } from "../../lib/text-language";

export { languageOf };
export type SpokenLanguage = TextLanguage;

const STORAGE_KEY = "kiwicue.ask.voiceLanguage";

export function readVoiceLanguage(): SpokenLanguage | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "zh" ? stored : null;
  } catch {
    return null; // Blocked storage falls back to the site language.
  }
}

export function writeVoiceLanguage(language: SpokenLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error; // Blocked storage only loses the remembered choice.
  }
}
