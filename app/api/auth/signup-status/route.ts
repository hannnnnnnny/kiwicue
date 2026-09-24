import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { PENDING_SIGNUP_COOKIE, readPendingSignupTicket } from "../../../../lib/auth/pending-signup-ticket";
import { supabasePublicConfig } from "../../../../lib/supabase/config";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const config = supabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret) return NextResponse.json({ confirmed: false }, { status: 503, headers: privateHeaders });
  const userId = readPendingSignupTicket(request.cookies.get(PENDING_SIGNUP_COOKIE)?.value, secret);
  if (!userId) return NextResponse.json({ confirmed: false }, { status: 401, headers: privateHeaders });

  const admin = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return NextResponse.json({ confirmed: false }, { status: 503, headers: privateHeaders });
    return NextResponse.json({ confirmed: Boolean(data.user?.email_confirmed_at) }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ confirmed: false }, { status: 503, headers: privateHeaders });
  }
}
