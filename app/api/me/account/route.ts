import "server-only";
import { createClient } from "@supabase/supabase-js";
import { confirmedAccountDeletion } from "../../../../lib/social/account-deletion";
import { verifiedUser } from "../../../../lib/supabase/server";
import { supabasePublicConfig } from "../../../../lib/supabase/config";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: privateHeaders });

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    return fail("Invalid request.", 403);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 100) return fail("Invalid request.", 400);
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 100) return fail("Invalid request.", 400);
    payload = JSON.parse(body) as unknown;
  } catch { return fail("Invalid request.", 400); }
  if (!confirmedAccountDeletion(payload)) return fail("Type DELETE to confirm.", 400);
  const { user } = await verifiedUser();
  if (!user) return fail("Sign in again before deleting your account.", 401);
  const config = supabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceKey) return fail("Account deletion is temporarily unavailable.", 503);
  const admin = createClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return fail("Account deletion failed. Please contact support.", 503);
  return Response.json({ deleted: true }, { headers: privateHeaders });
}
