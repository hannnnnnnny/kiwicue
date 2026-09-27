import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp, createServerClient } = vi.hoisted(() => {
  const verifyOtp = vi.fn();
  return { verifyOtp, createServerClient: vi.fn(() => ({ auth: { verifyOtp } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock("../lib/supabase/config", () => ({ supabasePublicConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key-123456789" }) }));

const base = "https://kiwicue.nz";

async function get(query: string) {
  const { GET } = await import("../app/auth/confirm/route");
  return GET(new Request(`${base}/auth/confirm?${query}`));
}

describe("email token confirmation route", () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    createServerClient.mockClear();
  });

  it("verifies a recovery token on whichever device opened the email and continues to reset-password", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    const response = await get("token_hash=hash-123&type=recovery");
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "hash-123" });
    expect(response.headers.get("location")).toBe(`${base}/reset-password`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ignores any next parameter so the email link cannot be turned into a redirect", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    const response = await get("token_hash=hash-123&type=recovery&next=https://evil.example");
    expect(response.headers.get("location")).toBe(`${base}/reset-password`);
  });

  it("sends expired or reused links back to request a new email", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: { status: 403, code: "otp_expired" } });
    const response = await get("token_hash=used&type=recovery");
    expect(response.headers.get("location")).toBe(`${base}/forgot-password?error=link`);
  });

  it("rejects missing tokens and unsupported types without calling Supabase", async () => {
    expect((await get("type=recovery")).headers.get("location")).toBe(`${base}/forgot-password?error=link`);
    expect((await get("token_hash=hash-123&type=magiclink")).headers.get("location")).toBe(`${base}/forgot-password?error=link`);
    expect((await get(`token_hash=${"x".repeat(3000)}&type=recovery`)).headers.get("location")).toBe(`${base}/forgot-password?error=link`);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
