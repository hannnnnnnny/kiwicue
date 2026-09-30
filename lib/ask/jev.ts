import "server-only";
import { typeSafeAi } from "@ai-sdk/typesafe-ai";
import { experimental_evaluate, type Experimental_EvaluationQuestion, type JSONValue } from "ai";

export const JEV_MODEL = "jev-latest";
export type JevQuestion = Experimental_EvaluationQuestion;
export type JevAnswer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> }
  | { type: "boolean"; probability: number };
export type Evaluate = (input: {
  state: Record<string, JSONValue>;
  questions: Record<string, JevQuestion>;
  abortSignal?: AbortSignal;
}) => Promise<{ answers: Record<string, JevAnswer>; inputTokens: number }>;

/** One Jev call: every question is judged independently against the same state. */
export const jevEvaluate: Evaluate = async ({ state, questions, abortSignal }) => {
  const result = await experimental_evaluate({
    model: typeSafeAi.evaluationModel(JEV_MODEL), state, questions, abortSignal, maxRetries: 1,
  });
  return { answers: result.answers as Record<string, JevAnswer>, inputTokens: result.usage.inputTokens ?? 0 };
};
