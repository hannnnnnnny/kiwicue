import type { AskFilters } from "./schema";

/** Exact minute boundaries are evaluated in Auckland local time, not the host timezone. */
export function matchesTimeWindow(minute: number | null, filters: AskFilters): boolean {
  if (minute === null || !Number.isInteger(minute) || minute < 0 || minute >= 1440) {
    return filters.timeOfDay === "any" && filters.startMinute === null && filters.endMinute === null;
  }
  const ranges = { any: [0, 1440], day: [0, 1020], morning: [0, 720], afternoon: [720, 1020], evening: [1020, 1440] };
  const [start, end] = ranges[filters.timeOfDay];
  return minute >= start && minute < end
    && (filters.startMinute === null || minute >= filters.startMinute)
    && (filters.endMinute === null || minute < filters.endMinute);
}

export function aucklandMinute(instant: string): number | null {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: "Pacific/Auckland", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return value("hour") * 60 + value("minute");
}

export function localMinute(time: string | null): number | null {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/u.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}
