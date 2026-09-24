import { parseBookmarks } from "../../../../lib/bookmarks";
import { eventIdInput } from "../../../../lib/social/validation";
import { parseSavedMutation } from "../../../../lib/social/saved-mutation";
import { verifiedUser } from "../../../../lib/supabase/server";

const privateHeaders = { "Cache-Control": "private, no-store" };
const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: privateHeaders });

function mutationAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin
    && request.headers.get("content-type")?.startsWith("application/json") === true;
}

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) throw new RangeError("too large");
  const text = await request.text();
  if (text.length > 2_000_000) throw new RangeError("too large");
  return JSON.parse(text) as unknown;
}

export async function GET() {
  const { client, user } = await verifiedUser();
  if (!client || !user) return fail("Sign in to sync saved events.", 401);
  const { data, error } = await client.from("saved_events")
    .select("event_snapshot, created_at").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(100);
  if (error) return fail("Saved events are temporarily unavailable.", 503);
  const items = (data ?? []).map((row) => ({ event: row.event_snapshot, savedAt: row.created_at }));
  const bookmarks = parseBookmarks(JSON.stringify({ version: 1, items }));
  return Response.json({ bookmarks }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  if (!mutationAllowed(request)) return fail("Invalid request origin or content type.", 403);
  const { client, user } = await verifiedUser();
  if (!client || !user) return fail("Sign in to sync saved events.", 401);
  let payload: unknown;
  try { payload = await readBody(request); } catch { return fail("Invalid saved event data.", 400); }
  const items = typeof payload === "object" && payload !== null && "events" in payload
    && Array.isArray(payload.events) ? payload.events : [payload];
  if (items.length < 1 || items.length > 100) return fail("Save between 1 and 100 events.", 400);
  const bookmarks = items.map(parseSavedMutation);
  if (bookmarks.some((item) => item === null)) return fail("Invalid saved event data.", 400);
  const validBookmarks = bookmarks.filter((item): item is NonNullable<typeof item> => item !== null);
  const deduped = [...new Map(validBookmarks.map((item) => [item.event.id, item])).values()];
  const { error } = await client.from("saved_events").upsert(deduped.map(({ event }) => ({
    user_id: user.id, event_id: event.id, event_snapshot: event,
  })), { onConflict: "user_id,event_id", ignoreDuplicates: true });
  if (error) return fail("Could not save events. Please retry.", 503);
  return Response.json({ saved: deduped.map(({ event }) => event.id) }, { headers: privateHeaders });
}

export async function DELETE(request: Request) {
  if (!mutationAllowed(request)) return fail("Invalid request origin or content type.", 403);
  const { client, user } = await verifiedUser();
  if (!client || !user) return fail("Sign in to sync saved events.", 401);
  let payload: unknown;
  try { payload = await readBody(request); } catch { return fail("Invalid request.", 400); }
  if (typeof payload !== "object" || payload === null) return fail("Invalid request.", 400);
  if ("eventId" in payload) {
    const parsed = eventIdInput.safeParse(payload.eventId);
    if (!parsed.success) return fail("Invalid event ID.", 400);
    const { error } = await client.from("saved_events").delete()
      .eq("user_id", user.id).eq("event_id", parsed.data);
    if (error) return fail("Could not remove saved event.", 503);
  } else if ("all" in payload && payload.all === true) {
    const { error } = await client.from("saved_events").delete().eq("user_id", user.id);
    if (error) return fail("Could not clear saved events.", 503);
  } else return fail("Invalid request.", 400);
  return Response.json({ ok: true }, { headers: privateHeaders });
}
