import { describe, expect, it } from "vitest";
import { chipsFor, clearChip } from "../lib/ask/chips";
import { dateRange, datesForWhen, sanitizeDates, widenDates } from "../lib/ask/resolve-dates";
import { EMPTY_FILTERS } from "../lib/ask/schema";

const NOW = new Date("2026-09-30T23:00:00Z"); // Thursday 1 Oct, 12:00 in Auckland (NZDT)

describe("ask dates", () => {
  it("maps when answers to Auckland dates", () => {
    expect(datesForWhen("any", NOW)).toEqual([]);
    expect(datesForWhen("today", NOW)).toEqual(["2026-10-01"]);
    expect(datesForWhen("tomorrow", NOW)).toEqual(["2026-10-02"]);
    expect(datesForWhen("weekend", NOW)).toEqual(["2026-10-03", "2026-10-04"]);
    expect(datesForWhen("week", NOW)).toHaveLength(7);
  });

  it("keeps only valid dates from today to 60 days ahead, sorted and unique", () => {
    expect(sanitizeDates(["2026-10-04", "2026-09-30", "2026-10-03", "2026-10-03", "2026-13-01", "2027-01-01"], NOW))
      .toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("turns dates into an instant range starting no earlier than now", () => {
    expect(dateRange(["2026-10-01"], NOW)).toEqual({ start: NOW, end: new Date("2026-10-01T11:00:00Z") });
    expect(dateRange(["2026-10-03", "2026-10-04"], NOW)).toEqual({ start: new Date("2026-10-02T11:00:00Z"), end: new Date("2026-10-04T11:00:00Z") });
    expect(dateRange([], NOW)).toEqual({ start: NOW, end: new Date("2026-10-30T23:00:00Z") });
  });

  it("widens dates by three days each way, never before today", () => {
    expect(widenDates(["2026-10-07"], NOW)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(widenDates(["2026-10-02"], NOW)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    expect(widenDates(["2026-10-10", "2026-10-11"], NOW)).toHaveLength(8);
    expect(widenDates([], NOW)).toEqual([]);
  });
});

describe("ask chips", () => {
  const filters = { ...EMPTY_FILTERS, domain: "events" as const, dates: ["2026-10-03"], timeOfDay: "evening" as const, area: "east" as const, kids: true, names: ["Bundle Baby"], place: "Botany" };

  it("labels only the filters that are set, in both languages", () => {
    expect(chipsFor(filters, "en").map((chip) => chip.label)).toEqual(["Events", "Sat 3 Oct", "Evening", "East", "With kids", "Botany", "Bundle Baby"]);
    expect(chipsFor(filters, "zh").map((chip) => chip.label)).toEqual(["活动", "10月3日周六", "晚上", "东区", "亲子", "Botany", "Bundle Baby"]);
    expect(chipsFor(EMPTY_FILTERS, "en")).toEqual([]);
    expect(chipsFor({ ...EMPTY_FILTERS, maxPrice: 30 }, "en")).toEqual([{ key: "maxPrice", label: "≤ $30" }]);
    expect(chipsFor({ ...EMPTY_FILTERS, maxPrice: 30 }, "zh")).toEqual([{ key: "maxPrice", label: "30 元以内" }]);
  });

  it("clears exactly the removed chip", () => {
    expect(clearChip(filters, "kids").kids).toBe(false);
    expect(clearChip(filters, "dates").dates).toEqual([]);
    expect(clearChip(filters, "name:0").names).toEqual([]);
    expect(clearChip(filters, "place").place).toBeNull();
    expect(clearChip({ ...filters, maxPrice: 30 }, "maxPrice").maxPrice).toBeNull();
    expect(clearChip(filters, "unknown")).toEqual(filters);
  });
});
