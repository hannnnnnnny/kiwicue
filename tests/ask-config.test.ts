import { afterEach, describe, expect, it, vi } from "vitest";
import { isAskConfigured } from "../lib/ask/config";
import { logAskFailure } from "../lib/ask/log";

const complete = {
  TYPESAFE_AI_API_KEY: "ts-test", DEEPSEEK_API_KEY: "ds-test", ASK_HASH_SALT: "salt-test-value-1234",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key-123456789",
  SUPABASE_SECRET_KEY: "secret-test",
};

describe("ask configuration", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is enabled only when every secret and Supabase is present", () => {
    expect(isAskConfigured(complete)).toBe(true);
    for (const key of ["TYPESAFE_AI_API_KEY", "DEEPSEEK_API_KEY", "ASK_HASH_SALT", "SUPABASE_SECRET_KEY"]) {
      expect(isAskConfigured({ ...complete, [key]: "" })).toBe(false);
    }
    expect(isAskConfigured({ ...complete, SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "legacy" })).toBe(true);
    expect(isAskConfigured({ ...complete, ASK_HASH_SALT: "short" })).toBe(false);
  });

  it("logs only the step, status and code of a failure", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logAskFailure("deepseek", Object.assign(new Error("secret prompt text"), { statusCode: 429, code: "rate_limit" }));
    const entry = JSON.parse(String(spy.mock.calls[0][0]));
    expect(entry).toEqual({ event: "ask_failure", step: "deepseek", status: 429, code: "rate_limit", name: "Error" });
    expect(JSON.stringify(entry)).not.toContain("secret prompt text");
  });
});
