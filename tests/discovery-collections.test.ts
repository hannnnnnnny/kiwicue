import { describe, expect, it } from "vitest";
import { selectCollectionEvents } from "../lib/discovery-collections";
import type { KiwiCueEvent } from "../lib/events";

const now = new Date("2026-09-26T05:00:00Z");
function event(id: string, time: string, extra: Partial<KiwiCueEvent> = {}): KiwiCueEvent {
  return { id, name: id, url: "https://example.com", imageUrl: null, category: "Music", status: "onsale", venue: null,
    start: { localDate: "2026-09-26", localTime: time, dateTime: null, timezone: "Pacific/Auckland" }, ...extra };
}
describe("discovery collections", () => {
  it("Tonight means upcoming starts tonight in Auckland, not the browser timezone", () => {
    const items = [event("past", "16:00:00"), event("tonight", "20:00:00"), event("unknown-time", "20:00:00", { status: "postponed" })];
    expect(selectCollectionEvents(items, "tonight", now).map(e => e.id)).toEqual(["tonight"]);
  });
  it("Tonight matches the Tonight filter: after midnight it is the coming evening, including shows before 3 am", () => {
    const earlyMorning = new Date("2026-09-25T15:00:00Z"); // 3 am NZST Sat 26 Sep
    const items = [event("evening", "20:00:00"), event("late", "01:30:00", { start: { localDate: "2026-09-27", localTime: "01:30:00", dateTime: null, timezone: "Pacific/Auckland" } }), event("daytime", "11:00:00")];
    expect(selectCollectionEvents(items, "tonight", earlyMorning).map(e => e.id)).toEqual(["evening", "late"]);
  });
  it("only explicit free admission qualifies", () => {
    expect(selectCollectionEvents([event("unknown", "20:00:00"), event("free", "20:00:00", { admission: { kind: "free", currency: "NZD" } })], "free", now).map(e => e.id)).toEqual(["free"]);
  });
  it("nearby uses real coordinates and omits unknown locations", () => {
    const venue = { id: "v", name: "Venue", city: "Auckland", address: null, postalCode: null };
    const items = [event("far", "20:00:00", { venue: { ...venue, coordinates: { latitude: -36.95, longitude: 174.8 } } }), event("unknown", "20:00:00"), event("near", "20:00:00", { venue: { ...venue, coordinates: { latitude: -36.85, longitude: 174.76 } } })];
    expect(selectCollectionEvents(items, "nearby", now, { latitude: -36.85, longitude: 174.76 }).map(e => e.id)).toEqual(["near", "far"]);
    expect(selectCollectionEvents(items, "nearby", now)).toHaveLength(2);
  });
});
