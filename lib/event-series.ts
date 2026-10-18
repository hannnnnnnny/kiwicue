import type { KiwiCueEvent } from "./events";

/** One show at one venue, with every upcoming session in start order. `lead` is the next session. */
export type EventSeries = {
  key: string;
  lead: KiwiCueEvent;
  events: KiwiCueEvent[];
};

export type EventSectionId = "music" | "theatre" | "family" | "sports" | "other";
export const EVENT_SECTION_ORDER: readonly EventSectionId[] = ["music", "theatre", "family", "sports", "other"];

function normalizedName(name: string): string {
  return name.normalize("NFKD").replace(/\p{Mark}/gu, "").toLocaleLowerCase("en-NZ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

function startKey(event: KiwiCueEvent): string {
  return event.start.dateTime ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}`;
}

/** Sessions of one show share a key: same name at the same venue. */
export function seriesKeyOf(event: KiwiCueEvent): string {
  return `${normalizedName(event.name)}|${event.venue?.id ?? normalizedName(event.venue?.name ?? "")}`;
}

/**
 * Ticketmaster lists every performance as its own event, so a children's show with three
 * sessions a day would otherwise fill the page. Sessions are grouped only when the name and
 * the venue both match: a touring act at two venues stays as two cards, and a variant such as
 * "Cabaret - Relaxed Performance" keeps its own card because its name differs.
 * Series keep the order in which they first appear in the input; `lead` is the earliest session.
 */
export function groupEventSeries(events: KiwiCueEvent[]): EventSeries[] {
  const series = new Map<string, KiwiCueEvent[]>();
  for (const event of events) {
    const key = seriesKeyOf(event);
    const sessions = series.get(key) ?? [];
    if (!sessions.some(({ id }) => id === event.id)) sessions.push(event);
    series.set(key, sessions);
  }
  return [...series].map(([key, sessions]) => {
    const ordered = [...sessions].sort((left, right) => startKey(left).localeCompare(startKey(right)));
    return { key, lead: ordered[0], events: ordered };
  });
}

export function eventSectionId(event: KiwiCueEvent): EventSectionId {
  const tags = (event.tags ?? []).join(" ");
  if (/family|children|kids/iu.test(tags)) return "family";
  if (/music/iu.test(event.category)) return "music";
  if (/arts|theatre|theater/iu.test(event.category)) return "theatre";
  if (/sport/iu.test(event.category)) return "sports";
  return "other";
}

export function groupSeriesBySection(series: EventSeries[]): Array<{ id: EventSectionId; series: EventSeries[] }> {
  return EVENT_SECTION_ORDER
    .map((id) => ({ id, series: series.filter(({ lead }) => eventSectionId(lead) === id) }))
    .filter(({ series: sectionSeries }) => sectionSeries.length > 0);
}
