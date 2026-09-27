import type { MovieDateFilter } from "../movies";

const TIME_ZONE = "Pacific/Auckland";
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
export const ALL_DATES_WINDOW_DAYS = 7;

export function aucklandDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function offsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * Cinema feeds that publish wall-clock times ("2026-09-29T19:30") mean Auckland time. The
 * offset is resolved twice so times either side of a daylight-saving change land correctly.
 */
export function aucklandLocalToIso(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const naive = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (!Number.isFinite(naive)) return null;
  const first = offsetMinutes(new Date(naive));
  const offset = offsetMinutes(new Date(naive - first * 60_000));
  return new Date(naive - offset * 60_000).toISOString();
}

export function datesForFilter(filter: MovieDateFilter, now: Date): string[] {
  const today = aucklandDate(now);
  if (filter === "today") return [today];
  if (filter === "tomorrow") return [addDays(today, 1)];
  if (filter === "all") return Array.from({ length: ALL_DATES_WINDOW_DAYS }, (_, index) => addDays(today, index));
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (day === 0) return [today];
  const saturdayOffset = (6 - day + 7) % 7;
  return [addDays(today, saturdayOffset), addDays(today, saturdayOffset + 1)];
}
