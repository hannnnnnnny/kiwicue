"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KiwiCueEvent } from "../lib/events";
import { toBookmark } from "../lib/bookmarks";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

type CollectionChoice = { id: string; name: string };

export function SaveToCollection({ event }: { event: KiwiCueEvent }) {
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [choices, setChoices] = useState<CollectionChoice[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    Promise.all([
      client.from("collections").select("id,name").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      client.from("collection_events").select("collection_id").eq("event_id", event.id).limit(100),
    ]).then(([collectionResult, membershipResult]) => {
      if (!active) return;
      if (collectionResult.error || membershipResult.error) { setState("error"); return; }
      setChoices(collectionResult.data as CollectionChoice[]);
      setSelected(new Set((membershipResult.data ?? []).map((item) => item.collection_id)));
      setState("ready");
    });
    return () => { active = false; };
  }, [user, event.id]);

  async function toggle(id: string) {
    const client = supabaseBrowser();
    if (!client || busy) return;
    const wasSelected = selected.has(id);
    setBusy(id); setError(false);
    const next = new Set(selected);
    if (wasSelected) next.delete(id); else next.add(id);
    setSelected(next);
    const result = wasSelected
      ? await client.from("collection_events").delete().eq("collection_id", id).eq("event_id", event.id)
      : await client.from("collection_events").insert({ collection_id: id, event_id: event.id, event_snapshot: toBookmark(event).event });
    setBusy(null);
    if (result.error) { setSelected(selected); setError(true); }
  }

  if (!enabled || loading) return null;
  if (!user) return <Link className="collection-login" href={`/login?next=/events/${encodeURIComponent(event.id)}`}>
    {language === "zh" ? "登录后加入清单" : "Log in to use collections"}
  </Link>;
  return <section className="event-collections" aria-label={language === "zh" ? "加入清单" : "Add to collection"}>
    <h2>{language === "zh" ? "加入清单" : "Add to a collection"}</h2>
    {state === "loading" && <p role="status">{language === "zh" ? "读取清单中…" : "Loading collections…"}</p>}
    {state === "error" && <p role="alert">{language === "zh" ? "无法读取清单，请刷新重试。" : "Could not load collections. Refresh to retry."}</p>}
    {state === "ready" && choices.length === 0 && <p>{language === "zh" ? "还没有清单。" : "No collections yet."} <Link href="/collections">{language === "zh" ? "创建清单" : "Create one"}</Link></p>}
    {state === "ready" && choices.length > 0 && <div className="event-collection-choices">{choices.map((choice) =>
      <button key={choice.id} type="button" aria-pressed={selected.has(choice.id)} disabled={Boolean(busy)} onClick={() => void toggle(choice.id)}>
        {selected.has(choice.id) ? "✓ " : "+ "}{choice.name}
      </button>)}</div>}
    {error && <p role="alert">{language === "zh" ? "保存失败，已恢复原状态。" : "Could not save. Your previous selection was restored."}</p>}
  </section>;
}
