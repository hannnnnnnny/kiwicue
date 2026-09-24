import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNextPath } from "../../../lib/auth/safe-next-path";
import { supabasePublicConfig } from "../../../lib/supabase/config";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = supabasePublicConfig();
  const code = url.searchParams.get("code");
  if (!config || !code || code.length > 2048) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }
  const cookieStore = await cookies();
  let response = NextResponse.redirect(new URL(safeNextPath(url.searchParams.get("next")), url.origin));
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) response = NextResponse.redirect(new URL("/login?error=auth", url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
