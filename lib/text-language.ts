export type TextLanguage = "en" | "zh";

const HAN = /\p{Script=Han}/gu;
// A couple of Chinese characters in a short line is a Chinese sentence; one stray character is not.
const MIN_HAN = 2;

/** Which language a line is written in: decides the reply language, the voice and the mic. */
export function languageOf(text: string): TextLanguage {
  return (text.match(HAN)?.length ?? 0) >= MIN_HAN ? "zh" : "en";
}
