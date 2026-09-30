import "server-only";
import { jevEvaluate, type Evaluate, type JevAnswer, type JevQuestion } from "./jev";
import type { AskWhen } from "./resolve-dates";
import type { AskArea, AskCategory, AskDomain, AskFilters, AskTime } from "./schema";

export type Toggle = "on" | "off";
export type JevUnderstanding = {
  domain?: AskDomain; when?: AskWhen; timeOfDay?: AskTime; area?: AskArea; category?: AskCategory; kids?: Toggle; free?: Toggle;
};

const MIN_CONFIDENCE = 0.6;
const UNMENTIONED = { unmentioned: "The latest message does not talk about this; keep whatever was asked before." };

// Every question offers "unmentioned" so a follow-up like "make it evening" only changes the time.
const QUESTIONS = {
  domain: { type: "choice", instructions: "What kind of outing is the latest message asking about?", criteria: { ...UNMENTIONED, any: "Anything to do, no type preference", events: "Concerts, shows, sport, festivals or other ticketed events", movies: "Films at a cinema", markets: "Markets, night markets, farmers markets" } },
  when: { type: "choice", instructions: "When does the person want to go, relative to today?", criteria: { ...UNMENTIONED, any: "Any time, explicitly no date preference", today: "Today or tonight", tomorrow: "Tomorrow", weekend: "This coming weekend", week: "Within the next seven days" } },
  timeOfDay: { type: "choice", instructions: "Which part of the day do they want?", criteria: { ...UNMENTIONED, any: "Explicitly any time of day", day: "Morning or afternoon", evening: "Evening or night" } },
  area: { type: "choice", instructions: "Which part of Auckland do they want to go to?", criteria: { ...UNMENTIONED, any: "Explicitly anywhere", north: "North Shore, Albany, Takapuna, Orewa", central: "CBD, Ponsonby, Newmarket, Mt Eden, Parnell", east: "Botany, Howick, Pakuranga, Mission Bay, Sylvia Park", south: "Manukau, Papatoetoe, Manurewa, Ormiston", west: "Henderson, New Lynn, Westgate, Titirangi" } },
  category: { type: "choice", instructions: "What kind of event do they want?", criteria: { ...UNMENTIONED, any: "Explicitly any kind", music: "Concerts and live music", theatre: "Theatre, musicals, comedy, dance, classical", family: "Things for children and families", sports: "Sports matches and games", other: "Tours, talks, exhibitions and other experiences" } },
  kids: { type: "choice", instructions: "Does the latest message say whether children are coming?", criteria: { ...UNMENTIONED, on: "Children are coming or it must suit kids", off: "Explicitly no longer needs to suit kids" } },
  free: { type: "choice", instructions: "Does the latest message ask about free entry?", criteria: { ...UNMENTIONED, on: "Only free things", off: "Explicitly fine to pay" } },
} as const satisfies Record<string, JevQuestion>;

function confident(answer: JevAnswer | undefined): string | undefined {
  if (!answer || answer.type !== "choice" || answer.choice === "unmentioned") return undefined;
  const probability = answer.probabilities?.[answer.choice] ?? 1;
  return probability >= MIN_CONFIDENCE ? answer.choice : undefined;
}

function toUnderstanding(answers: Record<string, JevAnswer>): JevUnderstanding {
  const pick = <T extends string>(key: keyof typeof QUESTIONS) => confident(answers[key]) as T | undefined;
  const entries = Object.entries({
    domain: pick<AskDomain>("domain"), when: pick<AskWhen>("when"), timeOfDay: pick<AskTime>("timeOfDay"),
    area: pick<AskArea>("area"), category: pick<AskCategory>("category"), kids: pick<Toggle>("kids"), free: pick<Toggle>("free"),
  }).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as JevUnderstanding;
}

export async function understandWithJev(input: {
  text: string; history: string[]; previous: AskFilters | null; today: string; evaluate?: Evaluate; abortSignal?: AbortSignal;
}): Promise<{ understanding: JevUnderstanding; inputTokens: number }> {
  const state = {
    latestMessage: input.text, earlierMessages: input.history, currentFilters: input.previous ? { ...input.previous } : null,
    today: input.today, city: "Auckland, New Zealand",
  };
  const { answers, inputTokens } = await (input.evaluate ?? jevEvaluate)({ state, questions: QUESTIONS, abortSignal: input.abortSignal });
  return { understanding: toUnderstanding(answers), inputTokens };
}
