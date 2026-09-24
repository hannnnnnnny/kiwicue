import type { KiwiCueEvent } from "../../lib/events";

export function makeEvent(id: string): KiwiCueEvent {
  return {
    id, name: "Auckland event", url: "https://example.com/events/A", imageUrl: null,
    start: { localDate: "2026-10-01", localTime: "19:00:00", dateTime: "2026-10-01T06:00:00Z", timezone: "Pacific/Auckland" },
    status: "onsale", category: "Music", venue: null,
  };
}
