import { describe, expect, it } from "vitest";
import { parseSavedMutation } from "../lib/social/saved-mutation";
import { makeEvent } from "./fixtures/social-event";

describe("cloud save input", () => {
  it("accepts a validated event snapshot", () => {
    expect(parseSavedMutation({ event: makeEvent("A") })?.event.id).toBe("A");
  });

  it("rejects IDs and URLs that would poison a saved card", () => {
    expect(parseSavedMutation({ event: makeEvent("../../bad") })).toBeNull();
    expect(parseSavedMutation({ event: { ...makeEvent("A"), url: "javascript:alert(1)" } })).toBeNull();
  });
});
