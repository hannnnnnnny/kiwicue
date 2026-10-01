import { expect, it } from "vitest";
import { matchesTimeWindow, localMinute, aucklandMinute } from "../lib/ask/time-window";
import { EMPTY_FILTERS } from "../lib/ask/schema";

it("morning start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(true); });

it("morning start boundary at minute 719", () => { expect(matchesTimeWindow(719, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(true); });

it("morning start boundary at minute 720", () => { expect(matchesTimeWindow(720, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(false); });

it("morning start boundary at minute 721", () => { expect(matchesTimeWindow(721, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(false); });

it("morning start boundary at minute 1020", () => { expect(matchesTimeWindow(1020, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(false); });

it("morning start boundary at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(false); });

it("afternoon start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("afternoon start boundary at minute 719", () => { expect(matchesTimeWindow(719, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("afternoon start boundary at minute 720", () => { expect(matchesTimeWindow(720, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(true); });

it("afternoon start boundary at minute 721", () => { expect(matchesTimeWindow(721, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(true); });

it("afternoon start boundary at minute 1019", () => { expect(matchesTimeWindow(1019, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(true); });

it("afternoon start boundary at minute 1020", () => { expect(matchesTimeWindow(1020, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("afternoon start boundary at minute 1140", () => { expect(matchesTimeWindow(1140, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("afternoon start boundary at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("evening start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(false); });

it("evening start boundary at minute 719", () => { expect(matchesTimeWindow(719, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(false); });

it("evening start boundary at minute 720", () => { expect(matchesTimeWindow(720, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(false); });

it("evening start boundary at minute 1019", () => { expect(matchesTimeWindow(1019, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(false); });

it("evening start boundary at minute 1020", () => { expect(matchesTimeWindow(1020, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(true); });

it("evening start boundary at minute 1140", () => { expect(matchesTimeWindow(1140, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(true); });

it("evening start boundary at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, timeOfDay: "evening" })).toBe(true); });

it("day start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(true); });

it("day start boundary at minute 719", () => { expect(matchesTimeWindow(719, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(true); });

it("day start boundary at minute 720", () => { expect(matchesTimeWindow(720, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(true); });

it("day start boundary at minute 1019", () => { expect(matchesTimeWindow(1019, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(true); });

it("day start boundary at minute 1020", () => { expect(matchesTimeWindow(1020, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(false); });

it("day start boundary at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, timeOfDay: "day" })).toBe(false); });

it("any start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "any" })).toBe(true); });

it("any start boundary at minute 720", () => { expect(matchesTimeWindow(720, { ...EMPTY_FILTERS, timeOfDay: "any" })).toBe(true); });

it("any start boundary at minute 1020", () => { expect(matchesTimeWindow(1020, { ...EMPTY_FILTERS, timeOfDay: "any" })).toBe(true); });

it("any start boundary at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, timeOfDay: "any" })).toBe(true); });

it("7 pm lower bound at minute 1139", () => { expect(matchesTimeWindow(1139, { ...EMPTY_FILTERS, startMinute: 1140 })).toBe(false); });

it("7 pm lower bound at minute 1140", () => { expect(matchesTimeWindow(1140, { ...EMPTY_FILTERS, startMinute: 1140 })).toBe(true); });

it("7 pm lower bound at minute 1141", () => { expect(matchesTimeWindow(1141, { ...EMPTY_FILTERS, startMinute: 1140 })).toBe(true); });

it("7 pm lower bound at minute 1439", () => { expect(matchesTimeWindow(1439, { ...EMPTY_FILTERS, startMinute: 1140 })).toBe(true); });

it("3 pm exclusive ceiling at minute 899", () => { expect(matchesTimeWindow(899, { ...EMPTY_FILTERS, endMinute: 900 })).toBe(true); });

it("3 pm exclusive ceiling at minute 900", () => { expect(matchesTimeWindow(900, { ...EMPTY_FILTERS, endMinute: 900 })).toBe(false); });

it("3 pm exclusive ceiling at minute 901", () => { expect(matchesTimeWindow(901, { ...EMPTY_FILTERS, endMinute: 900 })).toBe(false); });
