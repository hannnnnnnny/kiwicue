import { deriveEventArea } from "./event-discovery";
import type { KiwiCueEvent } from "./events";

const unavailableStatuses = new Set(["cancelled", "postponed", "offsale"]);

function eventTime(event: KiwiCueEvent): number | null {
  const source = event.start.dateTime
    ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}+12:00`;
  const value = new Date(source).getTime();
  return Number.isFinite(value) ? value : null;
}

function relevance(current: KiwiCueEvent, candidate: KiwiCueEvent): number {
  const sameCategory = current.category.trim().toLowerCase() === candidate.category.trim().toLowerCase();
  const sameVenue = Boolean(current.venue?.id && current.venue.id === candidate.venue?.id);
  const currentArea = deriveEventArea(current);
  const candidateArea = deriveEventArea(candidate);
  return (sameCategory ? 8 : 0)
    + (sameVenue ? 6 : 0)
    + (currentArea && currentArea === candidateArea ? 3 : 0)
    + (candidate.editorialPreview || candidate.source ? 1 : 0);
}

export function selectRelatedEvents(
  current: KiwiCueEvent,
  candidates: KiwiCueEvent[],
  now = new Date(),
  requestedLimit = 3,
): KiwiCueEvent[] {
  if (!Number.isFinite(now.getTime())) return [];
  const limit = Math.min(6, Math.max(1, Math.trunc(requestedLimit)));
  const unique = [...new Map(candidates.map((event) => [event.id, event])).values()];
  return unique
    .filter((event) => {
      const time = eventTime(event);
      return event.id !== current.id
        && time !== null
        && time >= now.getTime()
        && !unavailableStatuses.has(event.status.trim().toLowerCase());
    })
    .sort((left, right) => relevance(current, right) - relevance(current, left)
      || (eventTime(left) ?? Number.MAX_SAFE_INTEGER) - (eventTime(right) ?? Number.MAX_SAFE_INTEGER)
      || left.id.localeCompare(right.id))
    .slice(0, limit);
}
