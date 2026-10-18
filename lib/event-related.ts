import { deriveEventArea } from "./event-discovery";
import type { KiwiCueEvent } from "./events";
import { seriesKeyOf } from "./event-series";

const unavailableStatuses = new Set(["cancelled", "canceled", "postponed", "offsale"]);

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

function upcoming(candidates: KiwiCueEvent[], current: KiwiCueEvent, now: Date): KiwiCueEvent[] {
  const unique = [...new Map(candidates.map((event) => [event.id, event])).values()];
  return unique.filter((event) => {
    const time = eventTime(event);
    return event.id !== current.id
      && time !== null
      && time >= now.getTime()
      && !unavailableStatuses.has(event.status.trim().toLowerCase());
  });
}

const byTime = (left: KiwiCueEvent, right: KiwiCueEvent) =>
  (eventTime(left) ?? Number.MAX_SAFE_INTEGER) - (eventTime(right) ?? Number.MAX_SAFE_INTEGER);

/** Other shows worth a look: never more dates of this show, and each other show once. */
export function selectRelatedEvents(
  current: KiwiCueEvent,
  candidates: KiwiCueEvent[],
  now = new Date(),
  requestedLimit = 3,
): KiwiCueEvent[] {
  if (!Number.isFinite(now.getTime())) return [];
  const limit = Math.min(6, Math.max(1, Math.trunc(requestedLimit)));
  const seen = new Set([seriesKeyOf(current)]);
  return upcoming(candidates, current, now)
    .sort((left, right) => relevance(current, right) - relevance(current, left)
      || byTime(left, right)
      || left.id.localeCompare(right.id))
    .filter((event) => {
      const key = seriesKeyOf(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

/** This show's other upcoming dates at the same venue, soonest first. */
export function selectOtherSessions(current: KiwiCueEvent, candidates: KiwiCueEvent[], now = new Date(), limit = 8): KiwiCueEvent[] {
  if (!Number.isFinite(now.getTime())) return [];
  const key = seriesKeyOf(current);
  return upcoming(candidates, current, now)
    .filter((event) => seriesKeyOf(event) === key)
    .sort(byTime)
    .slice(0, limit);
}
