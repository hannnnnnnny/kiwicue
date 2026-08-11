import type { KiwiCueEvent } from "./events";

export interface EventNameSuggestion {
  name: string;
  category: string;
  localDate: string;
  venueName: string | null;
}

type RankedSuggestion = EventNameSuggestion & { score: number };

function searchable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("en-NZ")
    .replace(/\s+/gu, " ")
    .trim();
}

function matchScore(name: string, query: string): number | null {
  if (name.startsWith(query)) return 0;
  const index = name.indexOf(query);
  if (index >= 0) return name[index - 1] === " " ? 1 : 2;
  const tokens = query.split(" ").filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => name.includes(token)) ? 3 : null;
}

function toSuggestion(event: KiwiCueEvent, score: number): RankedSuggestion {
  return {
    name: event.name,
    category: event.category,
    localDate: event.start.localDate,
    venueName: event.venue?.name ?? null,
    score,
  };
}

export function suggestEventNames(
  events: readonly KiwiCueEvent[],
  query: string,
  limit = 6,
): EventNameSuggestion[] {
  const normalizedQuery = searchable(query);
  if ([...normalizedQuery].length < 2 || limit < 1) return [];

  const unique = new Map<string, RankedSuggestion>();
  for (const event of events) {
    const normalizedName = searchable(event.name);
    const score = matchScore(normalizedName, normalizedQuery);
    if (score === null) continue;
    const current = unique.get(normalizedName);
    if (!current || event.start.localDate < current.localDate) {
      unique.set(normalizedName, toSuggestion(event, score));
    }
  }

  return [...unique.values()]
    .sort((left, right) => left.score - right.score
      || left.localDate.localeCompare(right.localDate)
      || left.name.localeCompare(right.name, "en-NZ", { sensitivity: "base" }))
    .slice(0, limit)
    .map(({ name, category, localDate, venueName }) => ({
      name,
      category,
      localDate,
      venueName,
    }));
}

export function suggestEventNamesForVenue(
  events: readonly KiwiCueEvent[],
  query: string,
  limit: number,
  venueId?: string,
): EventNameSuggestion[] {
  const scopedEvents = venueId
    ? events.filter((event) => event.venue?.id === venueId)
    : events;
  return suggestEventNames(scopedEvents, query, limit);
}
