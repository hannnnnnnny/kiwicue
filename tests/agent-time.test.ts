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

it("reject unknown or invalid constrained minute null", () => { expect(matchesTimeWindow(null, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("reject unknown or invalid constrained minute -1", () => { expect(matchesTimeWindow(-1, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("reject unknown or invalid constrained minute 1440", () => { expect(matchesTimeWindow(1440, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("reject unknown or invalid constrained minute 3.5", () => { expect(matchesTimeWindow(3.5, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("reject unknown or invalid constrained minute Number.NaN", () => { expect(matchesTimeWindow(Number.NaN, { ...EMPTY_FILTERS, timeOfDay: "afternoon" })).toBe(false); });

it("parse local clock 00:00", () => { expect(localMinute("00:00")).toBe(0); });

it("parse local clock 12:00", () => { expect(localMinute("12:00")).toBe(720); });

it("parse local clock 19:30:00", () => { expect(localMinute("19:30:00")).toBe(1170); });

it("parse local clock 23:59", () => { expect(localMinute("23:59")).toBe(1439); });

it("parse local clock 24:00", () => { expect(localMinute("24:00")).toBe(null); });

it("parse local clock 12:60", () => { expect(localMinute("12:60")).toBe(null); });

it("parse local clock unknown", () => { expect(localMinute("unknown")).toBe(null); });

it("Auckland timezone conversion 2026-10-01T06:00:00Z", () => { expect(aucklandMinute("2026-10-01T06:00:00Z")).toBe(1140); });

it("Auckland timezone conversion 2026-06-01T06:00:00Z", () => { expect(aucklandMinute("2026-06-01T06:00:00Z")).toBe(1080); });
