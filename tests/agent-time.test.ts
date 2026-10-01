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
