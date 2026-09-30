import "server-only";
import { normalizedMovieTitle } from "../verified-movie-sessions";
import { byStartTime } from "./candidates";
import { jevEvaluate, type Evaluate, type JevQuestion } from "./jev";
import { logAskFailure } from "./log";
import type { AskCard, AskFilters } from "./schema";

export const BEST_MIN_SCORE = 0.5;
const LEVELS = ["Unrelated to the request", "Loosely related", "A good fit", "Exactly what was asked for"];

function isNamed(card: AskCard, names: readonly string[]): boolean {
  const title = normalizedMovieTitle(card.title);
  return names.some((name) => {
    const needle = normalizedMovieTitle(name);
    return needle.length > 0 && title.includes(needle);
  });
}

function question(card: AskCard): JevQuestion {
  return {
    type: "score",
    instructions: { task: "How well does this option match what the person asked for?", option: { kind: card.kind, title: card.title, when: card.when, venue: card.venue, price: card.priceText } },
    criteria: LEVELS,
  };
}

function scoreFrom(answer: { type: string; score?: number } | undefined): number {
  return answer?.type === "score" && typeof answer.score === "number" ? Math.min(1, Math.max(0, answer.score / (LEVELS.length - 1))) : 0;
}

/** Named shows go first; everything else is scored by Jev in one call. Jev failure → date order. */
export async function rankCards(input: { text: string; filters: AskFilters; cards: AskCard[]; evaluate?: Evaluate }): Promise<{ ranked: AskCard[]; inputTokens: number; degraded: boolean }> {
  const named = input.cards.filter((card) => isNamed(card, input.filters.names)).map((card) => ({ ...card, score: 1 })).sort(byStartTime);
  const rest = input.cards.filter((card) => !isNamed(card, input.filters.names));
  if (rest.length === 0) return { ranked: named, inputTokens: 0, degraded: false };
  try {
    const questions = Object.fromEntries(rest.map((card, index) => [`c${index}`, question(card)]));
    const { answers, inputTokens } = await (input.evaluate ?? jevEvaluate)({ state: { request: input.text, filters: { ...input.filters } }, questions });
    const scored = rest.map((card, index) => ({ ...card, score: scoreFrom(answers[`c${index}`]) }))
      .sort((left, right) => right.score - left.score || byStartTime(left, right));
    return { ranked: [...named, ...scored], inputTokens, degraded: false };
  } catch (error) {
    logAskFailure("jev", error);
    return { ranked: [...named, ...[...rest].sort(byStartTime)], inputTokens: 0, degraded: true };
  }
}
