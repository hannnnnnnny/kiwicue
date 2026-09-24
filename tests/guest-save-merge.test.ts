import { describe, expect, it } from "vitest";
import { mergeSavedEventIds } from "../lib/social/guest-save-merge";

describe("guest save migration", () => {
  it("preserves cloud saves and adds only missing guest IDs", () => {
    expect(mergeSavedEventIds(["A", "B"], ["B", "C", "C"])).toEqual(["A", "B", "C"]);
  });

  it("rejects malformed guest IDs rather than sending them to the database", () => {
    expect(mergeSavedEventIds([], ["valid-1", "../../bad", "", "valid-1"])).toEqual(["valid-1"]);
  });
});
