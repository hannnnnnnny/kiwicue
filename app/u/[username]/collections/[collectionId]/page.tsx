import { notFound } from "next/navigation";
import { PortalHeader } from "../../../../../components/portal-header";
import { PublicCollectionContent } from "../../../../../components/public-collection-content";
import { parseEventSnapshot } from "../../../../../lib/bookmarks";
import type { KiwiCueEvent } from "../../../../../lib/events";
import { usernameInput } from "../../../../../lib/social/validation";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function PublicCollectionPage({ params }: { params: Promise<{ username: string; collectionId: string }> }) {
  const { username, collectionId } = await params;
  if (!usernameInput.safeParse(username).success || !/^[0-9a-f-]{36}$/i.test(collectionId)) notFound();
  const client = await createSupabaseServerClient();
  if (!client) notFound();
  const { data: profile } = await client.from("profiles").select("id,display_name")
    .eq("username", username).eq("is_public", true).single();
  if (!profile) notFound();
  const { data: collection } = await client.from("collections").select("id,name,description")
    .eq("id", collectionId).eq("user_id", profile.id).eq("is_public", true).single();
  if (!collection) notFound();
  const { data: rows } = await client.from("collection_events").select("event_snapshot")
    .eq("collection_id", collectionId).order("position").limit(100);
  const events = (rows ?? []).map((row) => parseEventSnapshot(row.event_snapshot)).filter((item): item is KiwiCueEvent => item !== null);
  return <main className="account-page"><PortalHeader /><div className="account-settings"><header><h1>{collection.name}</h1><p>{profile.display_name}</p>{collection.description && <p>{collection.description}</p>}</header>
    <PublicCollectionContent events={events} /></div></main>;
}
