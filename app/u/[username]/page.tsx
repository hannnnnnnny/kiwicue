import { notFound } from "next/navigation";
import { PublicProfileContent, type PublicCollection, type PublicProfile } from "../../../components/public-profile-content";
import { PortalHeader } from "../../../components/portal-header";
import { usernameInput } from "../../../lib/social/validation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { parseEventSnapshot } from "../../../lib/bookmarks";
import type { KiwiCueEvent } from "../../../lib/events";

export const dynamic = "force-dynamic";
export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (!usernameInput.safeParse(username).success) notFound();
  const client = await createSupabaseServerClient();
  if (!client) notFound();
  const { data: profile } = await client.from("profiles")
    .select("id,username,display_name,bio,city,is_public").eq("username", username).eq("is_public", true).single();
  if (!profile) notFound();
  const [collectionResult, savedResult, goingResult] = await Promise.all([
    client.from("collections").select("id,name,description").eq("user_id", profile.id).eq("is_public", true).order("created_at", { ascending: false }).limit(100),
    client.from("saved_events").select("event_snapshot").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(24),
    client.from("event_user_status").select("event_id").eq("user_id", profile.id).in("status", ["going", "went"]).limit(24),
  ]);
  const savedEvents = (savedResult.data ?? []).map((row) => parseEventSnapshot(row.event_snapshot)).filter((item): item is KiwiCueEvent => item !== null);
  return <main className="account-page"><PortalHeader /><PublicProfileContent profile={profile as PublicProfile}
    collections={(collectionResult.data ?? []) as PublicCollection[]} savedEvents={savedEvents}
    goingEventIds={(goingResult.data ?? []).map((row) => row.event_id)} /></main>;
}
