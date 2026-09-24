"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventCard } from "../app/events/event-card";
import { parseEventSnapshot } from "../lib/bookmarks";
import type { KiwiCueEvent } from "../lib/events";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

type Collection = { id: string; name: string; description: string | null; is_public: boolean };
type Item = { event_id: string; event_snapshot: unknown };

export function CollectionDetailContent({ id }: { id: string }) {
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [events, setEvents] = useState<KiwiCueEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    Promise.all([
      client.from("collections").select("id,name,description,is_public").eq("id", id).eq("user_id", user.id).single(),
      client.from("collection_events").select("event_id,event_snapshot").eq("collection_id", id).order("position").limit(100),
    ]).then(([collectionResult, itemsResult]) => {
      if (!active) return;
      if (collectionResult.error || itemsResult.error) { setState("error"); return; }
      setCollection(collectionResult.data as Collection);
      setEvents((itemsResult.data as Item[]).map((item) => parseEventSnapshot(item.event_snapshot)).filter((item): item is KiwiCueEvent => item !== null));
      setState("ready");
    });
    return () => { active = false; };
  }, [id, user]);

  async function remove(eventId: string) {
    const client = supabaseBrowser();
    if (!client || busy) return;
    const prior = events;
    setBusy(eventId);
    setEvents((items) => items.filter((item) => item.id !== eventId));
    const { error } = await client.from("collection_events").delete().eq("collection_id", id).eq("event_id", eventId);
    setBusy(null);
    if (error) { setEvents(prior); setState("error"); }
  }

  if (loading || (user && state === "loading")) return <div className="account-settings" role="status">{language === "zh" ? "读取清单中…" : "Loading collection…"}</div>;
  if (!enabled) return <div className="account-settings" role="alert">{language === "zh" ? "清单尚未配置。" : "Collections are not configured yet."}</div>;
  if (!user) return <div className="account-settings"><h1>{language === "zh" ? "请先登录" : "Log in to view your collection"}</h1><Link href={`/login?next=/collections/${encodeURIComponent(id)}`}>{language === "zh" ? "登录" : "Log in"}</Link></div>;
  if (state === "error" || !collection) return <div className="account-settings" role="alert">{language === "zh" ? "无法读取清单，或清单不存在。" : "This collection is unavailable."}</div>;
  return <div className="account-settings"><header><Link href="/collections">{language === "zh" ? "← 我的清单" : "← Collections"}</Link><h1>{collection.name}</h1>{collection.description && <p>{collection.description}</p>}<p>{collection.is_public ? (language === "zh" ? "公开清单" : "Public collection") : (language === "zh" ? "私密清单" : "Private collection")}</p></header>
    {events.length === 0 ? <section className="account-section"><p>{language === "zh" ? "清单里还没有活动。" : "No events here yet."}</p><Link href="/events">{language === "zh" ? "浏览活动" : "Browse events"}</Link></section>
      : <div className="collection-event-grid">{events.map((event, index) => <div key={event.id}><EventCard event={event} index={index} language={language} /><button type="button" disabled={Boolean(busy)} onClick={() => void remove(event.id)}>{language === "zh" ? "从清单移除" : "Remove from collection"}</button></div>)}</div>}
  </div>;
}
