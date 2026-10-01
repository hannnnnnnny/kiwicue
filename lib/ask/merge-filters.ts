import { datesForWhen, sanitizeDates } from "./resolve-dates";
import { EMPTY_FILTERS, type AskFilters } from "./schema";
import type { JevUnderstanding, Toggle } from "./understand-jev";

/** Open-ended details Jev cannot enumerate, supplied by the conversation model's search call. */
export type Slots = { names: string[]; place: string | null; dates: string[]; mode: "refine" | "new"; maxPrice?: number | null; totalBudget?: number | null; partySize?: number; startMinute?: number | null; endMinute?: number | null };

function toggle(value: Toggle | undefined, current: boolean): boolean {
  return value === undefined ? current : value === "on";
}

function mergeDates(base: AskFilters, jev: JevUnderstanding | null, slots: Slots | null, now: Date): string[] {
  const explicit = sanitizeDates(slots?.dates ?? [], now);
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
 * those keys keep the previous value. A new request (mode "new") starts from scratch.
 */
export function mergeFilters(input: {
  previous: AskFilters | null; jev: JevUnderstanding | null; slots: Slots | null; now: Date;
}): AskFilters {
  const { jev, slots } = input;
  const base = !input.previous || slots?.mode === "new" ? EMPTY_FILTERS : input.previous;
  return {
    domain: jev?.domain ?? base.domain,
    dates: mergeDates(base, jev, slots, input.now),
    timeOfDay: jev?.timeOfDay ?? base.timeOfDay,
    area: jev?.area ?? base.area,
    category: jev?.category ?? base.category,
    kids: toggle(jev?.kids, base.kids),
    free: toggle(jev?.free, base.free),
    names: slots && slots.names.length > 0 ? slots.names : base.names,
    place: slots?.place ?? base.place,
    maxPrice: budget(slots?.maxPrice, base.maxPrice),
    totalBudget: slots?.totalBudget ?? base.totalBudget,
    partySize: slots?.partySize ?? base.partySize,
    startMinute: slots?.startMinute ?? base.startMinute,
    endMinute: slots?.endMinute ?? base.endMinute,
  };
}
