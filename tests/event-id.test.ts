import { describe, expect, it } from "vitest";
import { parseEventId } from "../lib/event-id";

describe("event ID parser", () => {
  it.each([
    "event-123",
    "event_123-A",
    "G5diZfkn0B-bh",
    "a",
    "a".repeat(128),
  ])("accepts one bounded Ticketmaster-style ID: %s", (value) => {
    expect(parseEventId(value)).toBe(value);
  });

  it.each([
    undefined,
    null,
    "",
    " event-123",
    "event-123 ",
    "../secret",
    "event/123",
    "event.123",
    "活动-123",
    "a".repeat(129),
    ["one", "two"],
  ])("rejects an unsafe or ambiguous ID: %j", (value) => {
    expect(parseEventId(value)).toBeNull();
  });
});
