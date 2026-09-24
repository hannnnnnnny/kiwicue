"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent } from "../lib/events";

export type PublicProfile = { id: string; username: string; display_name: string; bio: string | null; city: string | null };
export type PublicCollection = { id: string; name: string; description: string | null };

export function PublicProfileContent({ profile, collections, savedEvents, goingEventIds }: {
  profile: PublicProfile; collections: PublicCollection[];
  savedEvents: KiwiCueEvent[]; goingEventIds: string[];
}) {
  const { user, enabled } = useAuth();
  const { language } = useLanguage();
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client) return;
    let active = true;
    Promise.all([
      client.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", profile.id),
      user ? client.from("user_follows").select("follower_id").eq("following_id", profile.id)
        .eq("follower_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]).then(([followers, own]) => {
      if (!active || followers.error || own.error) return;
      setCount(followers.count ?? 0);
      setFollowing(Boolean(own.data));
    });
    return () => { active = false; };
  }, [profile.id, user]);

  async function toggleFollow() {
    const client = supabaseBrowser();
    if (!client || !user || busy) return;
    const previous = following;
    setBusy(true); setError(false); setFollowing(!previous);
    setCount((value) => value === null ? null : value + (previous ? -1 : 1));
    const result = previous
      ? await client.from("user_follows").delete().eq("follower_id", user.id).eq("following_id", profile.id)
      : await client.from("user_follows").insert({ follower_id: user.id, following_id: profile.id });
    setBusy(false);
    if (result.error) { setFollowing(previous); setCount((value) => value === null ? null : value + (previous ? 1 : -1)); setError(true); }
  }

  return <div className="account-settings public-profile"><header><p className="eyebrow">KiwiCue / Community</p><h1>{profile.display_name}</h1><p>@{profile.username}{profile.city ? ` · ${profile.city}` : ""}</p>{profile.bio && <p>{profile.bio}</p>}
    {count !== null && <p>{count} {language === "zh" ? "位关注者" : "followers"}</p>}
    {enabled && user?.id !== profile.id && (user ? <button type="button" aria-pressed={following} disabled={busy} onClick={() => void toggleFollow()}>{following ? (language === "zh" ? "已关注" : "Following") : (language === "zh" ? "关注" : "Follow")}</button> : <Link href={`/login?next=/u/${encodeURIComponent(profile.username)}`}>{language === "zh" ? "登录后关注" : "Log in to follow"}</Link>)}
    {error && <p role="alert">{language === "zh" ? "关注状态未保存，请重试。" : "Could not update follow. Try again."}</p>}
  </header><section className="account-section"><h2>{language === "zh" ? "公开清单" : "Public collections"}</h2>{collections.length === 0 ? <p>{language === "zh" ? "暂无公开清单。" : "No public collections yet."}</p> : <ul className="collection-list">{collections.map((item) => <li key={item.id} className="collection-row"><Link href={`/u/${encodeURIComponent(profile.username)}/collections/${item.id}`}>{item.name}</Link>{item.description && <p>{item.description}</p>}</li>)}</ul>}</section>
    {savedEvents.length > 0 && <section className="account-section"><h2>{language === "zh" ? "公开收藏" : "Shared saves"}</h2><div className="collection-event-grid">{savedEvents.map((event, index) => <EventCard key={event.id} event={event} index={index} language={language} />)}</div></section>}
    {goingEventIds.length > 0 && <section className="account-section"><h2>{language === "zh" ? "准备去或去过" : "Going and went"}</h2><ul>{goingEventIds.map((id) => <li key={id}><Link href={`/events/${encodeURIComponent(id)}`}>{language === "zh" ? "查看活动" : "View event"} · {id}</Link></li>)}</ul></section>}
  </div>;
}
