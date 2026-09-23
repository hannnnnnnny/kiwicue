import { Temporal } from "@js-temporal/polyfill";
import { buildEventDiscovery, filterEligibleDiscoveryEvents, sortDiscoveryEvents } from "./event-discovery";
import { distanceKm, isValidCoordinates } from "./distance";
import type { EventCoordinates, KiwiCueEvent } from "./events";

export type DiscoveryCollection = "all" | "tonight" | "weekend" | "free" | "music" | "nearby";

export function selectCollectionEvents(events: KiwiCueEvent[], collection: DiscoveryCollection, now: Date, position?: EventCoordinates): KiwiCueEvent[] {
  const available = sortDiscoveryEvents(filterEligibleDiscoveryEvents(events, now), "date");
  if (collection === "tonight") {
    const today = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO("Pacific/Auckland").toPlainDate().toString();
    return available.filter(event => event.start.localDate === today && Boolean(event.start.localTime) && event.start.localTime! >= "17:00");
  }
  if (collection === "weekend") return buildEventDiscovery(available, now).weekend;
  if (collection === "free") return available.filter(event => event.admission?.kind === "free");
  if (collection === "music") return available.filter(event => /music/i.test(event.category));
  if (collection !== "nearby") return available;
  const located = available.filter(event => event.venue?.coordinates && isValidCoordinates(event.venue.coordinates));
  if (!position || !isValidCoordinates(position)) return located;
  return located.sort((a, b) => distanceKm(position, a.venue!.coordinates!) - distanceKm(position, b.venue!.coordinates!));
}
