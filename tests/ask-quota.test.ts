import { afterEach, describe, expect, it, vi } from "vitest";
import { addUsage, costMicroUsd, ZERO_USAGE } from "../lib/ask/cost";
import { clientIp, createSupabaseQuotaStore, hashSubject } from "../lib/ask/quota";

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ rpc })) }));

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key-123456789",
  SUPABASE_SECRET_KEY: "secret-test",
};

describe("ask cost", () => {
  it("prices tokens at the peak rates", () => {
    const usage = addUsage(addUsage(ZERO_USAGE, { jevInputTokens: 3_000 }), { deepseekInputTokens: 1_000, deepseekOutputTokens: 100 });
    // 3000×0.04 + 1000×0.30 + 100×1.20 = 120 + 300 + 120 micro-USD
    expect(costMicroUsd(usage)).toBe(540);
    expect(costMicroUsd(ZERO_USAGE)).toBe(0);
  });
});

describe("ask quota", () => {
  afterEach(() => { rpc.mockReset(); vi.restoreAllMocks(); });

  it("reads the first forwarded address and hashes it with the salt", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIp(new Headers())).toBe("unknown");
    const hash = hashSubject("203.0.113.9", "salt-test-value-1234");
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hash).not.toContain("203.0.113.9");
    expect(hashSubject("203.0.113.9", "another-salt-value-99")).not.toBe(hash);
  });

  it("maps the reserve RPC result", async () => {
    rpc.mockResolvedValueOnce({ data: [{ allowed: true, reason: null, usage_id: "u-1", remaining: 4, degrade: false }], error: null });
    const store = createSupabaseQuotaStore(env)!;
    expect(await store.reserve("ip:abc", "guest", null)).toEqual({ allowed: true, usageId: "u-1", remaining: 4, degrade: false, tier: "guest" });
    expect(rpc).toHaveBeenCalledWith("ask_reserve", { p_subject: "ip:abc", p_tier: "guest", p_user: null });

    rpc.mockResolvedValueOnce({ data: [{ allowed: false, reason: "quota_exhausted", usage_id: null, remaining: 0, degrade: false }], error: null });
    expect(await store.reserve("user:1", "free", "1")).toEqual({ allowed: false, reason: "quota_exhausted", remaining: 0, tier: "free" });
  });

  it("fails closed when the RPC errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST", message: "down" } });
    const store = createSupabaseQuotaStore(env)!;
    expect(await store.reserve("ip:abc", "guest", null)).toEqual({ allowed: false, reason: "unavailable", remaining: 0, tier: "guest" });
  });

  it("records the cost of a finished ask", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await createSupabaseQuotaStore(env)!.recordCost("u-1", 540, true);
    expect(rpc).toHaveBeenCalledWith("ask_record_cost", { p_usage_id: "u-1", p_cost: 540, p_degraded: true });
  });

  it("is unavailable without the secret key", () => {
    expect(createSupabaseQuotaStore({ ...env, SUPABASE_SECRET_KEY: "" })).toBeNull();
  });
});
