import { afterEach, describe, expect, it, vi } from "vitest";
import { logAuthFailure } from "../lib/auth/log-auth-failure";

function lastEntry(spy: ReturnType<typeof vi.spyOn>) {
  return JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
}

describe("logAuthFailure", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records the Supabase status and code for a failed step", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logAuthFailure("signup-status", "admin-lookup", { status: 401, code: "invalid_api_key", message: "Invalid API key" });
    expect(lastEntry(spy)).toEqual({
      event: "auth_failure", route: "signup-status", step: "admin-lookup",
      status: 401, code: "invalid_api_key", message: "Invalid API key",
    });
  });

  it("redacts email addresses Supabase echoes back and caps the message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logAuthFailure("signup", "signup", new Error(`Email address "person@example.com" is invalid ${"x".repeat(400)}`));
    const entry = lastEntry(spy);
    expect(String(entry.message)).not.toContain("person@example.com");
    expect(String(entry.message)).toContain("[email]");
    expect(String(entry.message).length).toBeLessThanOrEqual(200);
  });

  it("ignores non-primitive fields instead of serialising arbitrary objects", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logAuthFailure("signup", "signup", { status: "500", code: { nested: true } });
    const entry = lastEntry(spy);
    expect(entry.status).toBeUndefined();
    expect(entry.code).toBeUndefined();
  });
});
