import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPendingSignupTicket, PENDING_SIGNUP_COOKIE } from "../lib/auth/pending-signup-ticket";

const { resend, getUserById, createClient } = vi.hoisted(() => {
  const resend = vi.fn();
  const getUserById = vi.fn();
  return { resend, getUserById, createClient: vi.fn(() => ({ auth: { resend, admin: { getUserById } } })) };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../lib/supabase/config", () => ({ supabasePublicConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key-123456789" }) }));

const secret = "test-secret-with-at-least-32-characters";
const userId = "123e4567-e89b-42d3-a456-426614174000";
const base = "https://kiwicue.vercel.app";
const url = `${base}/api/auth/signup-status/resend`;

function resendRequest({ origin = base, ticket = createPendingSignupTicket(userId, secret) }: { origin?: string; ticket?: string } = {}) {
  return new NextRequest(url, { method: "POST", headers: { origin, cookie: `${PENDING_SIGNUP_COOKIE}=${ticket}` } });
}

async function post(request: NextRequest) {
  const { POST } = await import("../app/api/auth/signup-status/resend/route");
  return POST(request);
}

describe("signup confirmation resend route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_SECRET_KEY", secret);
    resend.mockReset();
    getUserById.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects cross-origin requests and invalid tickets without touching Supabase", async () => {
    expect((await post(resendRequest({ origin: "https://evil.example" }))).status).toBe(403);
    expect((await post(resendRequest({ ticket: "garbage" }))).status).toBe(401);
    expect(getUserById).not.toHaveBeenCalled();
    expect(resend).not.toHaveBeenCalled();
  });

  it("resends to the address stored for the ticket's user, never one supplied by the browser", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: userId, email: "person@example.com", email_confirmed_at: null } }, error: null });
    resend.mockResolvedValue({ data: {}, error: null });
    const response = await post(resendRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(resend).toHaveBeenCalledWith({
      type: "signup", email: "person@example.com",
      options: { emailRedirectTo: `${base}/auth/confirmed` },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("reports an already confirmed account instead of sending again", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: userId, email: "person@example.com", email_confirmed_at: "2026-09-27T01:00:00Z" } }, error: null });
    const response = await post(resendRequest());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ confirmed: true });
    expect(resend).not.toHaveBeenCalled();
  });

  it("passes Supabase's email rate limit through as 429", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: userId, email: "person@example.com", email_confirmed_at: null } }, error: null });
    resend.mockResolvedValue({ data: {}, error: { status: 429, code: "over_email_send_rate_limit", message: "rate limited" } });
    expect((await post(resendRequest())).status).toBe(429);
  });

  it("logs why the admin lookup failed so a misconfigured secret key is diagnosable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getUserById.mockResolvedValue({ data: { user: null }, error: { status: 401, code: "invalid_api_key", message: "Invalid API key" } });
    expect((await post(resendRequest())).status).toBe(503);
    const entry = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
    expect(entry).toMatchObject({ route: "signup-resend", step: "admin-lookup", status: 401, code: "invalid_api_key" });
    expect(resend).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("fails closed when Supabase cannot send", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: userId, email: "person@example.com", email_confirmed_at: null } }, error: null });
    resend.mockResolvedValue({ data: {}, error: { status: 500, message: "smtp down" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await post(resendRequest());
    expect(JSON.parse(String(spy.mock.calls.at(-1)?.[0]))).toMatchObject({ step: "resend", status: 500 });
    spy.mockRestore();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("smtp");
  });
});
