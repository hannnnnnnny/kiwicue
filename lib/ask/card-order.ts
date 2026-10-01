import type { AskCard } from "./schema";

/** Event times carry an offset and film times are UTC, so compare instants rather than strings. */
export function byStartTime(left: Pick<AskCard, "when">, right: Pick<AskCard, "when">): number {
  const instant = (value: string) => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER; };
  return instant(left.when) - instant(right.when);
}
