import type { KiwiCueEvent } from "../events";
import { Temporal } from "@js-temporal/polyfill";

export type ForYouReason = "interest" | "saved-similarity" | "soon" | "upcoming";
export type RankedEvent = { event: KiwiCueEvent; reason: ForYouReason; matchedInterest?: string; score: number };

const blocked = new Set(["cancelled", "canceled", "postponed", "rescheduled", "offsale"]);
const interestTerms: Record<string, string[]> = {
  "live-music": ["music", "concert", "gig"], tech: ["tech", "technology"],
  ai: ["ai", "artificial intelligence"], startups: ["startup"],
  food: ["food", "market"], nightlife: ["nightlife", "night"],
  art: ["art", "gallery", "exhibition"], movies: ["film", "movie", "cinema"],
  comedy: ["comedy"], markets: ["market"], family: ["family", "kids"],
  sports: ["sport"], networking: ["networking"], workshops: ["workshop"],
  exhibitions: ["exhibition", "museum"],
};

function scoreEvent(event: KiwiCueEvent, interests: string[], savedCategories: string[], now: Date): RankedEvent | null {
  if (blocked.has(event.status.toLowerCase())) return null;
  let timestamp: number;
  try {
    timestamp = event.start.dateTime ? Date.parse(event.start.dateTime)
      : Temporal.ZonedDateTime.from(`${event.start.localDate}T${event.start.localTime ?? "23:59:59"}[${event.start.timezone}]`).epochMilliseconds;
  } catch { return null; }
  if (!Number.isFinite(timestamp) || timestamp < now.getTime()) return null;
  const keywords = [event.category, event.name, ...(event.tags ?? [])].join(" ").toLowerCase();
  const matchedInterest = interests.find((slug) => interestTerms[slug]?.some((term) => keywords.includes(term)));
  const savedMatch = savedCategories.some((category) => category.toLowerCase() === event.category.toLowerCase());
  const daysAway = (timestamp - now.getTime()) / 86_400_000;
  const soon = daysAway <= 7;
  const score = (matchedInterest ? 40 : 0) + (savedMatch ? 24 : 0)
    + (soon ? 12 : 0) + (event.imageUrl ? 3 : 0) + (event.venue ? 3 : 0);
  const reason: ForYouReason = matchedInterest ? "interest" : savedMatch ? "saved-similarity" : soon ? "soon" : "upcoming";
  return { event, reason, ...(matchedInterest ? { matchedInterest } : {}), score };
}

export function rankForYou(events: KiwiCueEvent[], context: {
  interests: string[]; savedCategories: string[];
}, now: Date): RankedEvent[] {
  const unique = new Set<string>();
  return events.flatMap((event) => {
    if (unique.has(event.id)) return [];
    unique.add(event.id);
    const ranked = scoreEvent(event, context.interests, context.savedCategories, now);
    return ranked ? [ranked] : [];
  }).sort((a, b) => b.score - a.score
    || a.event.start.localDate.localeCompare(b.event.start.localDate)
    || a.event.id.localeCompare(b.event.id));
}
