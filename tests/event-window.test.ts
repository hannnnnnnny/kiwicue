import { describe, expect, it } from "vitest";
import { parseEventWindow, resolveEventWindow } from "../lib/event-window";

describe("Auckland event windows", () => {
  it.each([
    [undefined, "all"],
    [null, "all"],
    ["", "all"],
    ["all", "all"],
    ["7d", "7d"],
    ["weekend", "weekend"],
    ["30d", "30d"],
    ["year", "all"],
    [["7d", "30d"], "all"],
  ] as const)("parses %j", (value, expected) => {
    expect(parseEventWindow(value)).toBe(expected);
  });

  it("resolves rolling windows from the exact request anchor", () => {
    const now = new Date("2026-07-31T03:15:00.000Z");
    expect(resolveEventWindow("7d", now)).toEqual({
      id: "7d",
      start: now,
      end: new Date("2026-08-07T03:15:00.000Z"),
    });
    expect(resolveEventWindow("30d", now)).toEqual({
      id: "30d",
      start: now,
      end: new Date("2026-08-30T03:15:00.000Z"),
    });
    expect(resolveEventWindow("all", now)).toEqual({ id: "all", start: now, end: null });
  });

  it.each([
    ["2026-07-30T22:00:00.000Z", "2026-07-31T12:00:00.000Z", "2026-08-02T12:00:00.000Z"],
    ["2026-08-01T01:00:00.000Z", "2026-08-01T01:00:00.000Z", "2026-08-02T12:00:00.000Z"],
    ["2026-08-02T01:00:00.000Z", "2026-08-02T01:00:00.000Z", "2026-08-02T12:00:00.000Z"],
    ["2026-09-24T22:00:00.000Z", "2026-09-25T12:00:00.000Z", "2026-09-27T11:00:00.000Z"],
  ])("resolves the next or current Auckland weekend across DST", (anchor, start, end) => {
    expect(resolveEventWindow("weekend", new Date(anchor))).toEqual({
      id: "weekend",
      start: new Date(start),
      end: new Date(end),
    });
  });

  it("rejects an invalid request anchor", () => {
    expect(() => resolveEventWindow("7d", new Date("invalid"))).toThrow("Invalid event window anchor");
  });
});
