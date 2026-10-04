import { mkdirSync, writeFileSync } from "node:fs";
import { tool } from "ai";
import { expect, it } from "vitest";
import { conversePrompt, deepseekConverse, REPLY_RESET, SEARCH_TOOL_DESCRIPTION, searchInputSchema, toModelMessages } from "../../lib/ask/converse";
import { moodFilter } from "../../lib/ask/mood";
import { languageOf } from "../../lib/text-language";
import { ASSISTANTS } from "../../lib/assistants";
import { legacyConversePrompt } from "./legacy-prompt";
import { measure, type ReplyMetrics } from "./metrics";
import { SCENARIOS, type Scenario } from "./scenarios";

// Real DeepSeek calls: each run costs a little. EVAL_RUNS repeats every scenario (replies vary at temperature 0.8).
const RUNS = Number(process.env.EVAL_RUNS ?? 2);
const VARIANTS = { legacy: legacyConversePrompt, current: conversePrompt } as const;
type Variant = keyof typeof VARIANTS;
const TODAY = "2026-10-07 (Wednesday)";
type Sample = { scenario: string; variant: Variant; run: number; reply: string; mood: string | null; searches: number; metrics: ReplyMetrics; tokens: { input: number; output: number } };

async function reply(scenario: Scenario, variant: Variant): Promise<Omit<Sample, "scenario" | "variant" | "run" | "metrics">> {
  let searches = 0;
  const tools = {
    search: tool({
      description: SEARCH_TOOL_DESCRIPTION, inputSchema: searchInputSchema,
      execute: async () => { searches += 1; return scenario.search ?? { found: 0, loosened: [], options: [] }; },
    }),
  };
  const system = VARIANTS[variant]({ assistant: ASSISTANTS[scenario.assistant], today: TODAY, filters: scenario.filters, shown: scenario.shown, replyLanguage: languageOf(scenario.message) });
  const turn = deepseekConverse({ system, messages: toModelMessages(scenario.history, scenario.message), tools, abortSignal: AbortSignal.timeout(45_000) });
  let text = "";
  let mood: string | null = null;
  const newFilter = () => moodFilter((delta) => { text += delta; }, (value) => { mood ??= value; });
  let filter = newFilter();
  for await (const delta of turn.textStream) {
    if (delta !== REPLY_RESET) { filter.push(delta); continue; }
    text = "";
    filter = newFilter();
  }
  filter.flush();
  const usage = await turn.usage;
  return { reply: text.trim(), mood, searches, tokens: { input: usage.inputTokens, output: usage.outputTokens } };
}

function average(samples: Sample[], pick: (metrics: ReplyMetrics) => number | boolean): string {
  const values = samples.map((sample) => Number(pick(sample.metrics)));
  return (values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)).toFixed(2);
}

function report(samples: Sample[]): string {
  const rows = (Object.keys(VARIANTS) as Variant[]).map((variant) => {
    const mine = samples.filter((sample) => sample.variant === variant);
    return `| ${variant} | ${average(mine, (m) => m.length)} | ${average(mine, (m) => m.titlesNamed)} | ${average(mine, (m) => m.timesRead)} | ${average(mine, (m) => m.priceCaveat)} | ${average(mine, (m) => m.endsWithQuestion)} | ${average(mine, (m) => m.menuQuestion)} | ${average(mine, (m) => m.wrongLanguage)} | ${mine.reduce((total, sample) => total + sample.tokens.input + sample.tokens.output, 0)} |`;
  });
  const replies = SCENARIOS.map((scenario) => [
    `### ${scenario.id} (${scenario.assistant}) — “${scenario.message}”`,
    ...samples.filter((sample) => sample.scenario === scenario.id).map((sample) => `- **${sample.variant} #${sample.run}** [${sample.mood ?? "no mood"}, ${sample.searches} search] ${sample.reply.replace(/\n+/gu, " ⏎ ")}`),
  ].join("\n"));
  return [
    `# Reply eval — ${new Date().toISOString()} — ${RUNS} run(s) per scenario`, "",
    "| prompt | length | titles named | times read | price caveat | ends with ? | menu question | wrong language | tokens |",
    "|---|---|---|---|---|---|---|---|---|", ...rows, "", ...replies,
  ].join("\n");
}

it("compares the shipped reply prompt with the current one on fixed conversations", async () => {
  expect(process.env.DEEPSEEK_API_KEY, "Put DEEPSEEK_API_KEY in .env.local to run the reply eval").toBeTruthy();
  const only = process.env.EVAL_VARIANTS?.split(",") as Variant[] | undefined;
  const jobs = SCENARIOS.flatMap((scenario) => (only ?? (Object.keys(VARIANTS) as Variant[])).flatMap((variant) =>
    Array.from({ length: RUNS }, (_, run) => ({ scenario, variant, run: run + 1 }))));
  const samples: Sample[] = [];
  // A few at a time keeps within DeepSeek's rate limits.
  for (let index = 0; index < jobs.length; index += 4) {
    const batch = await Promise.all(jobs.slice(index, index + 4).map(async ({ scenario, variant, run }) => {
      const result = await reply(scenario, variant);
      const titles = (scenario.search?.options ?? []).map((option) => option.title).concat(scenario.shown.map((item) => item.title));
      return { scenario: scenario.id, variant, run, ...result, metrics: measure(result.reply, titles, languageOf(scenario.message)) };
    }));
    samples.push(...batch);
  }
  mkdirSync("evals/replies/out", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  writeFileSync(`evals/replies/out/${stamp}.json`, JSON.stringify(samples, null, 2));
  writeFileSync(`evals/replies/out/${stamp}.md`, report(samples));
  console.log(report(samples).split("\n").slice(0, 6).join("\n"));
  expect(samples.every((sample) => sample.reply.length > 0)).toBe(true);
});
