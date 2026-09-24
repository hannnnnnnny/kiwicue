import "server-only";
import { parseEventSnapshot } from "../bookmarks";
import { verifiedUser } from "../supabase/server";
import { buildRecommendationContext, type RecommendationContext } from "./recommendation-context";

export async function getUserRecommendationContext(): Promise<RecommendationContext | null> {
  const { client, user } = await verifiedUser();
  if (!client || !user) return null;
  const [selected, catalog, saved, going, profile] = await Promise.all([
    client.from("user_interests").select("interest_id").eq("user_id", user.id).limit(30),
    client.from("interests").select("id,slug").limit(100),
    client.from("saved_events").select("event_snapshot").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    client.from("event_user_status").select("event_id").eq("user_id", user.id).eq("status", "going").limit(20),
    client.from("profiles").select("city").eq("id", user.id).single(),
  ]);
  if (selected.error || catalog.error || saved.error || going.error || profile.error) return null;
  const ids = new Set((selected.data ?? []).map((row) => row.interest_id));
  return buildRecommendationContext({
    interests: (catalog.data ?? []).filter((row) => ids.has(row.id)).map((row) => row.slug),
    savedCategories: (saved.data ?? []).flatMap((row) => {
      const event = parseEventSnapshot(row.event_snapshot);
      return event ? [event.category] : [];
    }),
    goingEventIds: (going.data ?? []).map((row) => row.event_id),
    city: profile.data.city,
  });
}
