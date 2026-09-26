import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PENDING_SIGNUP_COOKIE, readPendingSignupTicket } from "../../../../../lib/auth/pending-signup-ticket";
import { supabasePublicConfig } from "../../../../../lib/supabase/config";
import { logAuthFailure } from "../../../../../lib/auth/log-auth-failure";

const privateHeaders = { "Cache-Control": "private, no-store" };

function reply(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: privateHeaders });
}

/**
 * Lives under /api/auth/signup-status because the pending-signup cookie is path-scoped there.
 * The recipient comes from the ticket's user record, so this can never be used to mail
 * arbitrary addresses; Supabase still enforces its own per-address resend cooldown.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return reply(403, { sent: false });
  const config = supabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret) return reply(503, { sent: false });
  const userId = readPendingSignupTicket(request.cookies.get(PENDING_SIGNUP_COOKIE)?.value, secret);
  if (!userId) return reply(401, { sent: false });

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  try {
    const { data, error } = await createClient(config.url, secret, options).auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (error || !email) {
      logAuthFailure("signup-resend", "admin-lookup", error ?? { message: "User has no email" });
      return reply(503, { sent: false });
    }
    if (data.user?.email_confirmed_at) return reply(409, { confirmed: true });

    const { error: sendError } = await createClient(config.url, config.key, options).auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: new URL("/auth/confirmed", request.nextUrl.origin).href },
    });
    if (sendError?.status === 429) return reply(429, { sent: false });
    if (sendError) {
      logAuthFailure("signup-resend", "resend", sendError);
      return reply(503, { sent: false });
    }
    return reply(200, { sent: true });
  } catch (error) {
    logAuthFailure("signup-resend", "resend", error);
    return reply(503, { sent: false });
  }
}
