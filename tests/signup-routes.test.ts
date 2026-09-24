import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createPendingSignupTicket, PENDING_SIGNUP_COOKIE } from "../lib/auth/pending-signup-ticket";

const { signUp, getUserById, createClient } = vi.hoisted(() => {
  const signUp = vi.fn();
  const getUserById = vi.fn();
  return { signUp, getUserById, createClient: vi.fn(() => ({ auth: { signUp, admin: { getUserById } } })) };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("../lib/supabase/config", () => ({ supabasePublicConfig: () => ({ url: "https://example.supabase.co", key: "public-test-key-123456789" }) }));

const secret = "test-secret-with-at-least-32-characters";
const userId = "123e4567-e89b-42d3-a456-426614174000";
const base = "https://kiwicue.vercel.app";

function signupRequest(body: unknown, origin = base): NextRequest {
  return new NextRequest(`${base}/api/auth/signup`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("cross-device signup routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("SUPABASE_SECRET_KEY", secret);
    signUp.mockReset();
    getUserById.mockReset();
    createClient.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects cross-origin and malformed registration before calling Supabase", async () => {
    const { POST } = await import("../app/api/auth/signup/route");
    expect((await POST(signupRequest({ email: "a@example.com", password: "password123" }, "https://evil.example"))).status).toBe(403);
    expect((await POST(signupRequest({ email: "invalid", password: "short" }))).status).toBe(400);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("creates a pending signup with a private cookie and phone confirmation URL", async () => {
    signUp.mockResolvedValue({ data: { user: { id: userId }, session: null }, error: null });
    const { POST } = await import("../app/api/auth/signup/route");
    const response = await POST(signupRequest({ email: "person@example.com", password: "password123" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pending: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "person@example.com", password: "password123",
      options: { emailRedirectTo: `${base}/auth/confirmed` },
    });
    const cookie = response.cookies.get(PENDING_SIGNUP_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.value).not.toContain("password123");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns only a confirmation bit for a valid ticket", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: userId, email_confirmed_at: "2026-09-24T05:00:00Z" } }, error: null });
    const { GET } = await import("../app/api/auth/signup-status/route");
    const ticket = createPendingSignupTicket(userId, secret);
    const request = new NextRequest(`${base}/api/auth/signup-status`, { headers: { cookie: `${PENDING_SIGNUP_COOKIE}=${ticket}` } });
    const response = await GET(request);
    expect(await response.json()).toEqual({ confirmed: true });
    expect(getUserById).toHaveBeenCalledWith(userId);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not query users for an invalid ticket", async () => {
    const { GET } = await import("../app/api/auth/signup-status/route");
    const response = await GET(new NextRequest(`${base}/api/auth/signup-status`, { headers: { cookie: `${PENDING_SIGNUP_COOKIE}=garbage` } }));
    expect(response.status).toBe(401);
    expect(getUserById).not.toHaveBeenCalled();
  });
});
