import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { authInput } from "../../../../lib/social/validation";
import { supabasePublicConfig } from "../../../../lib/supabase/config";
import { createPendingSignupTicket, PENDING_SIGNUP_COOKIE, PENDING_SIGNUP_TTL_MS } from "../../../../lib/auth/pending-signup-ticket";

const privateHeaders = { "Cache-Control": "private, no-store" };

function fail(status: number) {
  return NextResponse.json({ error: "Signup could not be completed. Please try again." }, { status, headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return fail(413);

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return fail(413);
    payload = JSON.parse(body) as unknown;
  } catch { return fail(400); }
  const parsed = authInput.safeParse(payload);
  if (!parsed.success) return fail(400);

  const config = supabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret || secret.length < 32) return fail(503);

  const client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" },
  });
  try {
    const { data, error } = await client.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: new URL("/auth/confirmed", request.nextUrl.origin).href },
    });
    if (error || !data.user) return fail(503);
    const response = NextResponse.json({ pending: !data.session }, { headers: privateHeaders });
    if (!data.session) {
      response.cookies.set(PENDING_SIGNUP_COOKIE, createPendingSignupTicket(data.user.id, secret), {
        httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax",
        path: "/api/auth/signup-status", maxAge: PENDING_SIGNUP_TTL_MS / 1000,
      });
    }
    return response;
  } catch { return fail(503); }
}
