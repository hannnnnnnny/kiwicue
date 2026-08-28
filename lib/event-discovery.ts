import { Temporal } from "@js-temporal/polyfill";
import type { EventAreaId, KiwiCueEvent } from "./events";
import type { EventSort } from "./event-search-params";
import { resolveEventWindow } from "./event-window";

export type EventDateGroup = { date: string; events: KiwiCueEvent[] };

export type DiscoveryModel = {
  lead: KiwiCueEvent[];
  weekend: KiwiCueEvent[];
  picks: KiwiCueEvent[];
  free: KiwiCueEvent[];
  areas: Array<{ id: EventAreaId; count: number }>;
  dateGroups: EventDateGroup[];
};

const blockedStatuses = new Set(["cancelled", "postponed", "offsale"]);

function eventInstant(event: KiwiCueEvent): Temporal.Instant | null {
  try {
    if (event.start.dateTime) return Temporal.Instant.from(event.start.dateTime);
    return Temporal.ZonedDateTime.from(
      `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}[Pacific/Auckland]`,
    ).toInstant();
  } catch {
    return null;
  }
}

function completenessScore(event: KiwiCueEvent): number {
  return (eventInstant(event) ? 16 : 0)
    + (event.imageUrl || event.editorialPreview?.image ? 8 : 0)
    + (event.venue?.name ? 4 : 0)
    + (event.venue?.city ? 2 : 0)
    + (event.source?.url ? 4 : 0)
    + (event.editorialPreview ? 12 : 0);
}

export function sortDiscoveryEvents(events: KiwiCueEvent[], sort: EventSort): KiwiCueEvent[] {
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  return unique.sort((left, right) => {
    const leftTime = eventInstant(left)?.epochMilliseconds ?? Number.MAX_SAFE_INTEGER;
    const rightTime = eventInstant(right)?.epochMilliseconds ?? Number.MAX_SAFE_INTEGER;
    return (sort === "recommended" ? completenessScore(right) - completenessScore(left) : 0)
      || leftTime - rightTime
      || left.id.localeCompare(right.id);
  });
}

export function groupEventsByAucklandDate(events: KiwiCueEvent[]): EventDateGroup[] {
  const groups = new Map<string, KiwiCueEvent[]>();
  for (const event of events) {
    const group = groups.get(event.start.localDate) ?? [];
    group.push(event);
    groups.set(event.start.localDate, group);
  }
  return [...groups]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, grouped]) => ({ date, events: grouped }));
}

export function filterEligibleDiscoveryEvents(events: KiwiCueEvent[], now: Date): KiwiCueEvent[] {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid discovery anchor");
  const unique = [...new Map(events.map((event) => [event.id, event])).values()];
  return unique.filter((event) => {
    const start = eventInstant(event)?.epochMilliseconds;
    return start !== undefined
      && start >= now.getTime()
      && !blockedStatuses.has(event.status.trim().toLowerCase());
  });
}

export function deriveEventArea(event: KiwiCueEvent): EventAreaId | null {
  if (event.areaId) return event.areaId;
  const coordinates = event.venue?.coordinates;
  if (!coordinates) return null;
  const { latitude, longitude } = coordinates;
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -37.3 && latitude <= -36.45
    && longitude >= 174.3 && longitude <= 175.2;
  if (!valid) return null;
  if (latitude <= -36.95) return "south";
  if (longitude < 174.70) return "west";
  if (longitude > 174.82) return "east";
  if (latitude > -36.80) return "north";
  return "central";
}

export function buildEventDiscovery(events: KiwiCueEvent[], now: Date): DiscoveryModel {
  const available = sortDiscoveryEvents(filterEligibleDiscoveryEvents(events, now), "recommended");
  const weekendWindow = resolveEventWindow("weekend", now);
  const weekendEnd = weekendWindow.end?.getTime() ?? weekendWindow.start.getTime();
  const weekend = available.filter((event) => {
    const start = eventInstant(event)?.epochMilliseconds ?? -1;
    return start >= weekendWindow.start.getTime() && start < weekendEnd;
  });
  const counts = new Map<EventAreaId, number>();
  for (const event of available) {
    const area = deriveEventArea(event);
    if (area) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return {
    lead: available.slice(0, 3),
    weekend,
    picks: available.filter((event) => Boolean(event.editorialPreview || event.source)),
    free: available.filter((event) => event.admission?.kind === "free"),
    areas: [...counts].map(([id, count]) => ({ id, count })),
    dateGroups: groupEventsByAucklandDate(available),
  };
}
