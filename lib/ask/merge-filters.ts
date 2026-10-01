import { datesForWhen, sanitizeDates } from "./resolve-dates";
import { EMPTY_FILTERS, type AskFilters } from "./schema";
import type { DeepSeekUnderstanding } from "./understand-deepseek";
import type { JevUnderstanding, Toggle } from "./understand-jev";

function toggle(value: Toggle | undefined, current: boolean): boolean {
  return value === undefined ? current : value === "on";
}

function mergeDates(base: AskFilters, jev: JevUnderstanding | null, deepseek: DeepSeekUnderstanding | null, now: Date): string[] {
  const explicit = sanitizeDates(deepseek?.dates ?? [], now);
  if (explicit.length > 0) return explicit;
  return jev?.when === undefined ? base.dates : datesForWhen(jev.when, now);
}

const MAX_BUDGET = 1000;

function budget(value: number | null | undefined, current: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return current;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= MAX_BUDGET ? rounded : null;
}

/**
 * A follow-up only changes what it mentions: Jev answers "unmentioned" for everything else, so
 * those keys keep the previous value. A new question (DeepSeek mode "new") starts from scratch.
 */
export function mergeFilters(input: {
  previous: AskFilters | null; jev: JevUnderstanding | null; deepseek: DeepSeekUnderstanding | null; now: Date;
}): AskFilters {
  const { jev, deepseek } = input;
  const base = !input.previous || deepseek?.mode === "new" ? EMPTY_FILTERS : input.previous;
  return {
    domain: jev?.domain ?? base.domain,
    dates: mergeDates(base, jev, deepseek, input.now),
    timeOfDay: jev?.timeOfDay ?? base.timeOfDay,
    area: jev?.area ?? base.area,
    category: jev?.category ?? base.category,
    kids: toggle(jev?.kids, base.kids),
    free: toggle(jev?.free, base.free),
    names: deepseek && deepseek.names.length > 0 ? deepseek.names : base.names,
    place: deepseek?.place ?? base.place,
    maxPrice: budget(deepseek?.maxPrice, base.maxPrice),
  };
}
