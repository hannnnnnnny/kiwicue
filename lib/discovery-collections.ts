import { Temporal } from "@js-temporal/polyfill";
import { buildEventDiscovery, filterEligibleDiscoveryEvents, sortDiscoveryEvents } from "./event-discovery";
import { distanceKm, isValidCoordinates } from "./distance";
import type { EventCoordinates, KiwiCueEvent } from "./events";
import { EVENING_STARTS, NIGHT_ENDS } from "./event-window";

const hour = (value: number) => `${String(value).padStart(2, "0")}:00`;

/** Starts during today's Auckland evening, 5 pm to 3 am: the same night the Tonight filter shows. */
function startsTonight(event: KiwiCueEvent, now: Date): boolean {
  const time = event.start.localTime;
  if (!time) return false;
  const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO("Pacific/Auckland").toPlainDate();
  if (event.start.localDate === today.toString()) return time >= hour(EVENING_STARTS);
  return event.start.localDate === today.add({ days: 1 }).toString() && time < hour(NIGHT_ENDS);
}

export type DiscoveryCollection = "all" | "tonight" | "weekend" | "free" | "music" | "nearby";

export function selectCollectionEvents(events: KiwiCueEvent[], collection: DiscoveryCollection, now: Date, position?: EventCoordinates): KiwiCueEvent[] {
  const available = sortDiscoveryEvents(filterEligibleDiscoveryEvents(events, now), "date");
  if (collection === "tonight") return available.filter(event => startsTonight(event, now));
  if (collection === "weekend") return buildEventDiscovery(available, now).weekend;
  if (collection === "free") return available.filter(event => event.admission?.kind === "free");
  if (collection === "music") return available.filter(event => /music/i.test(event.category));
  if (collection !== "nearby") return available;
  const located = available.filter(event => event.venue?.coordinates && isValidCoordinates(event.venue.coordinates));
  if (!position || !isValidCoordinates(position)) return located;
  return located.sort((a, b) => distanceKm(position, a.venue!.coordinates!) - distanceKm(position, b.venue!.coordinates!));
}
