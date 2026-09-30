import { Temporal } from "@js-temporal/polyfill";
import { addDays, aucklandDate, datesForFilter } from "../cinemas/auckland-time";

export type AskWhen = "any" | "today" | "tomorrow" | "weekend" | "week";
const MAX_DAYS_AHEAD = 60;
const DEFAULT_RANGE_DAYS = 30;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function datesForWhen(when: AskWhen, now: Date): string[] {
  if (when === "any") return [];
  return datesForFilter(when === "week" ? "all" : when, now);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  try {
    return Temporal.PlainDate.from(value, { overflow: "reject" }).toString() === value;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

export function sanitizeDates(dates: readonly string[], now: Date): string[] {
  const today = aucklandDate(now);
  const last = addDays(today, MAX_DAYS_AHEAD);
  return [...new Set(dates)].filter((date) => isRealDate(date) && date >= today && date <= last).sort().slice(0, 14);
}

function startOfAucklandDay(date: string): Date {
  const instant = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: "Pacific/Auckland" }).toInstant();
  return new Date(instant.epochMilliseconds);
}

/** The instant range covering the given Auckland dates, never starting in the past. */
export function dateRange(dates: readonly string[], now: Date): { start: Date; end: Date } {
  if (dates.length === 0) return { start: now, end: new Date(now.getTime() + DEFAULT_RANGE_DAYS * 86_400_000) };
  const first = startOfAucklandDay(dates[0]);
  const end = startOfAucklandDay(addDays(dates[dates.length - 1], 1));
  return { start: first.getTime() > now.getTime() ? first : now, end };
}
