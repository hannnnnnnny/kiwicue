import { describe, expect, it } from "vitest";
import { confirmedAccountDeletion } from "../lib/social/account-deletion";

describe("account deletion confirmation", () => {
  it("requires the exact confirmation phrase", () => {
    expect(confirmedAccountDeletion({ confirmation: "DELETE" })).toBe(true);
    expect(confirmedAccountDeletion({ confirmation: "delete" })).toBe(false);
    expect(confirmedAccountDeletion({ confirmation: "DELETE", userId: "someone-else" })).toBe(false);
  });
});
