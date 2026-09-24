import { describe, expect, it } from "vitest";
import { createPendingSignupTicket, readPendingSignupTicket } from "../lib/auth/pending-signup-ticket";

const secret = "test-secret-with-at-least-32-characters";
const userId = "123e4567-e89b-42d3-a456-426614174000";

describe("pending signup ticket", () => {
  it("accepts a signed ticket within its 15-minute lifetime", () => {
    const token = createPendingSignupTicket(userId, secret, 1_000);
    expect(readPendingSignupTicket(token, secret, 1_000 + 14 * 60_000)).toBe(userId);
  });

  it("rejects expired, tampered and wrong-secret tickets", () => {
    const token = createPendingSignupTicket(userId, secret, 1_000);
    expect(readPendingSignupTicket(token, secret, 1_000 + 15 * 60_000 + 1)).toBeNull();
    expect(readPendingSignupTicket(`${token}x`, secret, 2_000)).toBeNull();
    expect(readPendingSignupTicket(token, "another-secret-with-at-least-32-characters", 2_000)).toBeNull();
  });

  it("rejects malformed user IDs", () => {
    expect(() => createPendingSignupTicket("not-a-user-id", secret)).toThrow();
  });
});
