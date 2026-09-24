import { describe, expect, it } from "vitest";
import { activityInput } from "../lib/social/activity";

describe("private activity input", () => {
  it("accepts a bounded domain action without arbitrary metadata", () => {
    expect(activityInput.safeParse({ action: "event_save", eventId: "abc_1" }).success).toBe(true);
    expect(activityInput.safeParse({ action: "event_save", eventId: "abc_1", password: "secret" }).success).toBe(false);
    expect(activityInput.safeParse({ action: "search", eventId: "bad/route" }).success).toBe(false);
  });
});
