import { languageOf, type TextLanguage } from "../../lib/text-language";

/** Signs of a templated, catalogue-style reply, measured the same way for both prompts. */
export type ReplyMetrics = {
  /** English words, or Chinese characters divided by two so the two languages compare roughly. */
  length: number;
  /** How many of the offered titles the reply names. */
  titlesNamed: number;
  /** Clock times read out, which the cards already show. */
  timesRead: number;
  /** Says prices are unknown or to check the event page, unprompted. */
  priceCaveat: boolean;
  endsWithQuestion: boolean;
  /** "music, comedy, or something else?" style multiple-choice question. */
  menuQuestion: boolean;
  bullets: number;
  /** Answered in a different language from the visitor's message. */
  wrongLanguage: boolean;
};

const HAN = /\p{Script=Han}/gu;
const TIME = /\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\d{1,2}[:：]\d{2}|[上下晚]午?\s?\d{1,2}\s?点|\d{1,2}\s?点(?:半|\d{1,2}分)?/giu;
const PRICE_CAVEAT = /prices? (?:aren't|are not|isn't|is not|not) (?:listed|shown|known|available)|check the (?:event|official) page|(?:票价|价格)(?:还)?(?:没|未|不)(?:有|查到|列出|公布|确定)|以官方为准|出发前.*确认/iu;
const MENU = /(?:,|，|、)[^?？]{0,40}(?:\bor\b|还是|或者)[^?？]{0,40}[?？]\s*$/iu;

export function measure(reply: string, titles: string[], language: TextLanguage = languageOf(reply)): ReplyMetrics {
  const text = reply.trim();
  const han = text.match(HAN)?.length ?? 0;
  const words = text.replace(HAN, " ").split(/\s+/u).filter((word) => /\p{L}/u.test(word)).length;
  const lower = text.toLowerCase();
  return {
    length: Math.round(words + han / 2),
    titlesNamed: new Set(titles.filter((title) => lower.includes(title.toLowerCase().split(" - ")[0].split(" — ")[0]))).size,
    timesRead: text.match(TIME)?.length ?? 0,
    priceCaveat: PRICE_CAVEAT.test(text),
    endsWithQuestion: /[?？]\s*$/u.test(text),
    menuQuestion: MENU.test(text),
    bullets: text.split("\n").filter((line) => /^\s*(?:[-*•]|\d+[.)])\s/u.test(line)).length,
    wrongLanguage: languageOf(text) !== language,
  };
}
