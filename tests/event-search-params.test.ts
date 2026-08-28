import { describe, expect, it } from "vitest";
import { parseEventKeyword, parseEventSort, parseVenueId } from "../lib/event-search-params";

describe("event search parameters", () => {
  it("accepts only supported result sorts", () => {
    expect(parseEventSort("date")).toBe("date");
    expect(parseEventSort("recommended")).toBe("recommended");
    expect(parseEventSort("popular")).toBe("recommended");
    expect(parseEventSort(["date"])).toBe("recommended");
  });

  it.each([
    ["  Taylor   Swift  ", "Taylor Swift"],
    ["Beyonce\u0301", "Beyonc\u00e9"],
    ["\u5468\u6770\u4f26", "\u5468\u6770\u4f26"],
  ])("normalizes one event keyword", (value, expected) => {
    expect(parseEventKeyword(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    ["Taylor", "Swift"],
    "a".repeat(101),
    "bad\u0000query",
    "Taylor\tSwift",
    "Taylor\nSwift",
    "Taylor\u0085Swift",
  ])(
    "rejects an absent or unsafe event keyword",
    (value) => expect(parseEventKeyword(value)).toBeNull(),
  );

  it.each([
    ["KovZpZA6t7kA", "KovZpZA6t7kA"],
    ["venue_123-ABC", "venue_123-ABC"],
  ])("accepts one conservative venue ID", (value, expected) => {
    expect(parseVenueId(value)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "bad venue",
    ["one", "two"],
    "a".repeat(81),
    "\u573a\u9986",
    "\tvenue-1",
    "venue-1\n",
  ])(
    "rejects an absent or unsafe venue ID",
    (value) => expect(parseVenueId(value)).toBeNull(),
  );
});
