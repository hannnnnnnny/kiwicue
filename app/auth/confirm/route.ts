import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "../../../lib/supabase/config";

// Only password recovery lands here; widen deliberately if other email templates move over.
const DESTINATIONS = { recovery: "/reset-password" } as const;
type SupportedType = keyof typeof DESTINATIONS;

function isSupported(type: string | null): type is SupportedType {
  return type !== null && Object.hasOwn(DESTINATIONS, type);
}

function redirect(url: URL, path: string) {
  const response = NextResponse.redirect(new URL(path, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * Email links carry a token hash that the server verifies directly. Unlike the PKCE code
 * exchange in /auth/callback, this needs no verifier from the browser that requested the
 * email, so a reset asked for on a laptop can be completed from a phone. The destination
 * is fixed per type, never taken from the link.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = supabasePublicConfig();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!config || !tokenHash || tokenHash.length > 2048 || !isSupported(type)) {
    return redirect(url, "/forgot-password?error=link");
  }

  const cookieStore = await cookies();
  let response = redirect(url, DESTINATIONS[type]);
  const client = createServerClient(config.url, config.key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) { values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });
  const { error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) response = redirect(url, "/forgot-password?error=link");
  return response;
}
