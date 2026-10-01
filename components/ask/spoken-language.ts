export type SpokenLanguage = "en" | "zh";

const STORAGE_KEY = "kiwicue.ask.voiceLanguage";
const HAN = /\p{Script=Han}/gu;
// A couple of Chinese characters in a short line is a Chinese sentence; one stray character is not.
const MIN_HAN = 2;

/** Which language a line is in, so it is spoken with the right voice and the mic listens for it. */
export function languageOf(text: string): SpokenLanguage {
  return (text.match(HAN)?.length ?? 0) >= MIN_HAN ? "zh" : "en";
}

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
