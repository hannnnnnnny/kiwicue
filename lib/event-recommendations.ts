import { Temporal } from "@js-temporal/polyfill";
import type { KiwiCueEvent } from "./events";

export type RecommendationReason =
  | "saved-affinity"
  | "weekend"
  | "soon"
  | "verified"
  | "well-detailed"
  | "upcoming";

export interface EventRecommendation {
  event: KiwiCueEvent;
  reason: RecommendationReason;
}

export interface EventRecommendationSections {
  startHere: EventRecommendation[];
  weekend: EventRecommendation[];
  somethingDifferent: EventRecommendation[];
}

interface Candidate {
  event: KiwiCueEvent;
  instant: Temporal.Instant;
  category: string;
  score: number;
  affinity: boolean;
}

interface RecommendationContext {
  now: Temporal.Instant;
  weekendStart: Temporal.Instant;
  weekendEnd: Temporal.Instant;
  savedIds: Set<string>;
  savedCategories: Set<string>;
  savedVenues: Set<string>;
  dominantCategory: string | null;
}

const BLOCKED_STATUSES = new Set([
  "cancelled",
  "postponed",
  "rescheduled",
  "offsale",
]);
const AUCKLAND_TIME_ZONE = "Pacific/Auckland";

function categoryKey(event: KiwiCueEvent): string {
  const value = event.category.trim().toLowerCase();
  if (value.includes("music")) return "music";
  if (value.includes("sport")) return "sports";
  if (value.includes("theatre") || value.includes("arts")) return "theatre";
  if (value.includes("market")) return "markets";
  if (value.includes("festival") || event.name.toLowerCase().includes("festival")) return "festivals";
  return value || "other";
}

function eventInstant(event: KiwiCueEvent): Temporal.Instant | null {
  try {
    if (event.start.dateTime) return Temporal.Instant.from(event.start.dateTime);
    const time = event.start.localTime ?? "00:00:00";
    return Temporal.ZonedDateTime.from(
      `${event.start.localDate}T${time}[${event.start.timezone || AUCKLAND_TIME_ZONE}]`,
    ).toInstant();
  } catch {
    return null;
  }
}

function weekendBounds(now: Temporal.Instant) {
  const localNow = now.toZonedDateTimeISO(AUCKLAND_TIME_ZONE);
  const daysToStart = localNow.dayOfWeek === 7 ? -1 : (6 - localNow.dayOfWeek + 7) % 7;
  const start = localNow.startOfDay().add({ days: daysToStart });
  return { weekendStart: start.toInstant(), weekendEnd: start.add({ days: 2 }).toInstant() };
}

function dominantCategory(events: KiwiCueEvent[]): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    const category = categoryKey(event);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

function createContext(savedEvents: KiwiCueEvent[], nowDate: Date): RecommendationContext {
  const now = Temporal.Instant.fromEpochMilliseconds(nowDate.getTime());
  return {
    now,
    ...weekendBounds(now),
    savedIds: new Set(savedEvents.map((event) => event.id)),
    savedCategories: new Set(savedEvents.map(categoryKey)),
    savedVenues: new Set(savedEvents.flatMap((event) => event.venue?.id ? [event.venue.id] : [])),
    dominantCategory: dominantCategory(savedEvents),
  };
}

function scoreEvent(event: KiwiCueEvent, instant: Temporal.Instant, context: RecommendationContext) {
  const categoryAffinity = context.savedCategories.has(categoryKey(event));
  const venueAffinity = Boolean(event.venue?.id && context.savedVenues.has(event.venue.id));
  const daysAway = daysBetween(context.now, instant);
  let score = categoryAffinity ? 30 : 0;
  score += venueAffinity ? 24 : 0;
  score += daysAway <= 7 ? 20 : 0;
  score += isWeekend(instant, context) ? 16 : 0;
  score += hasConfirmedAvailability(event) ? 12 : 0;
  score += event.source ? 6 : 0;
  score += event.venue ? 4 : 0;
  score += event.imageUrl ? 4 : 0;
  return { score, affinity: categoryAffinity || venueAffinity };
}

function hasConfirmedAvailability(event: KiwiCueEvent) {
  return ["onsale", "schedule_verified"].includes(event.status.trim().toLowerCase());
}

function isWellDetailed(event: KiwiCueEvent) {
  return Boolean(event.venue && (event.imageUrl || event.editorialPreview));
}

function daysBetween(start: Temporal.Instant, end: Temporal.Instant) {
  return start.until(end, { largestUnit: "seconds" }).seconds / 86_400;
}

function isWeekend(instant: Temporal.Instant, context: RecommendationContext) {
  return Temporal.Instant.compare(instant, context.weekendStart) >= 0
    && Temporal.Instant.compare(instant, context.weekendEnd) < 0;
}

function candidates(events: KiwiCueEvent[], context: RecommendationContext): Candidate[] {
  const seen = new Set<string>();
  return events.flatMap((event) => {
    const instant = eventInstant(event);
    const unavailable = BLOCKED_STATUSES.has(event.status.trim().toLowerCase());
    if (seen.has(event.id) || !instant || unavailable || context.savedIds.has(event.id)) return [];
    if (Temporal.Instant.compare(instant, context.now) < 0) return [];
    seen.add(event.id);
    const scored = scoreEvent(event, instant, context);
    return [{ event, instant, category: categoryKey(event), ...scored }];
  }).sort(compareCandidates);
}

function compareCandidates(a: Candidate, b: Candidate) {
  return b.score - a.score
    || Temporal.Instant.compare(a.instant, b.instant)
    || a.event.name.localeCompare(b.event.name)
    || a.event.id.localeCompare(b.event.id);
}

function chooseDiverse(items: Candidate[], limit: number): Candidate[] {
  const chosen: Candidate[] = [];
  const categories = new Set<string>();
  const venues = new Set<string>();
  for (const item of items) {
    const venue = item.event.venue?.id;
    if (categories.has(item.category) || (venue && venues.has(venue))) continue;
    chosen.push(item);
    categories.add(item.category);
    if (venue) venues.add(venue);
    if (chosen.length === limit) return chosen;
  }
  for (const item of items) {
    if (!chosen.includes(item)) chosen.push(item);
    if (chosen.length === limit) break;
  }
  return chosen;
}

function reasonFor(candidate: Candidate, context: RecommendationContext): RecommendationReason {
  if (candidate.affinity) return "saved-affinity";
  if (isWeekend(candidate.instant, context)) return "weekend";
  const daysAway = daysBetween(context.now, candidate.instant);
  if (daysAway <= 7) return "soon";
  if (candidate.event.source) return "verified";
  if (isWellDetailed(candidate.event)) return "well-detailed";
  return "upcoming";
}

function recommendations(items: Candidate[], context: RecommendationContext) {
  return items.map((candidate) => ({ event: candidate.event, reason: reasonFor(candidate, context) }));
}

export function buildEventRecommendations(input: {
  events: KiwiCueEvent[];
  savedEvents: KiwiCueEvent[];
  now: Date;
}): EventRecommendationSections {
  const context = createContext(input.savedEvents, input.now);
  const available = candidates(input.events, context);
  const startHere = chooseDiverse(available, 3);
  const used = new Set(startHere.map((item) => item.event.id));
  const weekend = chooseDiverse(
    available.filter((item) => !used.has(item.event.id) && isWeekend(item.instant, context)),
    4,
  );
  weekend.forEach((item) => used.add(item.event.id));
  const remaining = available.filter((item) => !used.has(item.event.id));
  const alternatives = context.dominantCategory
    ? remaining.filter((item) => item.category !== context.dominantCategory)
    : remaining;
  const different = chooseDiverse(alternatives.length ? alternatives : remaining, 4);
  return {
    startHere: recommendations(startHere, context),
    weekend: recommendations(weekend, context),
    somethingDifferent: recommendations(different, context),
  };
}
