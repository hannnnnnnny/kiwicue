import { activityInput } from "../../../../lib/social/activity";
import { verifiedUser } from "../../../../lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers });

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin
    || !request.headers.get("content-type")?.startsWith("application/json")) return fail("Invalid request.", 403);
  if (Number(request.headers.get("content-length") ?? 0) > 256) return fail("Invalid request.", 400);
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 256) return fail("Invalid request.", 400);
    input = JSON.parse(body) as unknown;
  } catch { return fail("Invalid request.", 400); }
  const parsed = activityInput.safeParse(input);
  if (!parsed.success) return fail("Invalid activity.", 400);
  const { client, user } = await verifiedUser();
  if (!client || !user) return fail("Sign in first.", 401);
  const { data: settings, error: settingsError } = await client.from("privacy_settings")
    .select("allow_activity_tracking").eq("user_id", user.id).single();
  if (settingsError || !settings?.allow_activity_tracking) return fail("Activity recording is off.", 403);
  const { error } = await client.from("user_activity").insert({
    user_id: user.id, event_id: parsed.data.eventId, action: parsed.data.action,
  });
  if (error) return fail("Activity could not be saved.", 503);
  return Response.json({ recorded: true }, { headers });
}
