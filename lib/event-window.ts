import { Temporal } from "@js-temporal/polyfill";

export const EVENT_WINDOWS = ["7d", "weekend", "30d", "all"] as const;

export type EventWindow = (typeof EVENT_WINDOWS)[number];
type PublicValue = string | readonly string[] | null | undefined;

export type ResolvedEventWindow = {
  id: EventWindow;
  start: Date;
  end: Date | null;
};

const supported = new Set<string>(EVENT_WINDOWS);

export function parseEventWindow(value: PublicValue): EventWindow {
  return typeof value === "string" && supported.has(value)
    ? value as EventWindow
    : "all";
}

export function resolveEventWindow(
  id: EventWindow,
  now = new Date(),
): ResolvedEventWindow {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Invalid event window anchor");
  }

  const instant = Temporal.Instant.fromEpochMilliseconds(now.getTime());
  if (id === "all") {
    return { id, start: new Date(now.getTime()), end: null };
  }

  if (id === "7d" || id === "30d") {
    const hours = id === "7d" ? 7 * 24 : 30 * 24;
    return {
      id,
      start: new Date(now.getTime()),
      end: new Date(instant.add({ hours }).epochMilliseconds),
    };
  }

  const auckland = instant.toZonedDateTimeISO("Pacific/Auckland");
  const saturday = auckland.dayOfWeek === 6
    ? auckland.startOfDay()
    : auckland.dayOfWeek === 7
      ? auckland.subtract({ days: 1 }).startOfDay()
      : auckland.add({ days: 6 - auckland.dayOfWeek }).startOfDay();
  const weekendStart = saturday.toInstant();
  const start = Temporal.Instant.compare(instant, weekendStart) > 0
    ? instant
    : weekendStart;

  return {
    id,
    start: new Date(start.epochMilliseconds),
    end: new Date(saturday.add({ days: 2 }).toInstant().epochMilliseconds),
  };
}
