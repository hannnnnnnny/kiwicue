"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { collectionInput } from "../lib/social/validation";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

type Collection = { id: string; name: string; description: string | null; is_public: boolean; created_at: string };

function CollectionRow({ collection, language, onChanged, onDeleted }: {
  collection: Collection; language: "en" | "zh";
  onChanged: (collection: Collection) => void; onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(collection.name);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function update(changes: Partial<Collection>) {
    const client = supabaseBrowser();
    if (!client || busy) return;
    const parsed = collectionInput.safeParse({ name: changes.name ?? collection.name,
      description: collection.description, isPublic: changes.is_public ?? collection.is_public });
    if (!parsed.success) { setError(true); return; }
    setBusy(true); setError(false);
    const { data, error: updateError } = await client.from("collections").update({
      name: parsed.data.name, is_public: parsed.data.isPublic,
    }).eq("id", collection.id).select("id,name,description,is_public,created_at").single();
    setBusy(false);
    if (updateError || !data) setError(true);
    else onChanged(data as Collection);
  }

  async function remove() {
    if (!armed) { setArmed(true); return; }
    const client = supabaseBrowser();
    if (!client || busy) return;
    setBusy(true);
    const { error: deleteError } = await client.from("collections").delete().eq("id", collection.id);
    setBusy(false);
    if (deleteError) setError(true);
    else onDeleted(collection.id);
  }

  return <li className="collection-row">
    <div><Link href={`/collections/${collection.id}`}>{collection.name}</Link><p>{collection.description}</p><small>{collection.is_public ? (language === "zh" ? "公开" : "Public") : (language === "zh" ? "仅自己可见" : "Private")}</small></div>
    <div className="collection-row-actions">
      <button type="button" disabled={busy} onClick={() => void update({ is_public: !collection.is_public })}>{collection.is_public ? (language === "zh" ? "设为私密" : "Make private") : (language === "zh" ? "设为公开" : "Make public")}</button>
      <details><summary>{language === "zh" ? "重命名" : "Rename"}</summary><form onSubmit={(event) => { event.preventDefault(); void update({ name }); }}><label>{language === "zh" ? "清单名称" : "Collection name"}<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><button type="submit" disabled={busy}>{language === "zh" ? "保存" : "Save"}</button></form></details>
      <button type="button" disabled={busy} className={armed ? "destructive" : undefined} onClick={() => void remove()}>{armed ? (language === "zh" ? "确认删除" : "Confirm delete") : (language === "zh" ? "删除" : "Delete")}</button>
    </div>
    {error && <p role="alert">{language === "zh" ? "操作失败，请重试。" : "Could not update collection. Try again."}</p>}
  </li>;
}

export function CollectionsPageContent() {
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    Promise.all([
      client.from("collections").select("id,name,description,is_public,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      client.from("privacy_settings").select("default_collections_public").eq("user_id", user.id).single(),
    ]).then(([collectionResult, privacyResult]) => {
        if (!active) return;
        if (collectionResult.error || privacyResult.error) setState("error");
        else {
          setCollections(collectionResult.data as Collection[]);
          setIsPublic(Boolean(privacyResult.data.default_collections_public));
          setState("ready");
        }
      });
    return () => { active = false; };
  }, [user, retry]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabaseBrowser();
    if (!client || !user || busy) return;
    const parsed = collectionInput.safeParse({ name, isPublic });
    if (!parsed.success) { setError(language === "zh" ? "名称需要 1–80 个字。" : "Use a name between 1 and 80 characters."); return; }
    setBusy(true); setError("");
    const { data, error: createError } = await client.from("collections")
      .insert({ user_id: user.id, name: parsed.data.name, is_public: parsed.data.isPublic ?? false })
      .select("id,name,description,is_public,created_at").single();
    setBusy(false);
    if (createError || !data) setError(language === "zh" ? "创建失败，请重试。" : "Could not create collection.");
    else { setName(""); setIsPublic(false); setCollections((items) => [data as Collection, ...items]); }
  }

  if (loading) return <section className="account-panel" role="status">{language === "zh" ? "正在读取账号…" : "Loading account…"}</section>;
  if (!enabled) return <section className="account-panel" role="alert">{language === "zh" ? "清单功能尚未配置。" : "Collections are not configured yet."}</section>;
  if (!user) return <section className="account-panel"><h1>{language === "zh" ? "创建你的活动清单" : "Your collections"}</h1><Link href="/login?next=/collections">{language === "zh" ? "登录" : "Log in"}</Link></section>;

  return <div className="account-settings"><header><p className="eyebrow">KiwiCue / Saved</p><h1>{language === "zh" ? "我的清单" : "Collections"}</h1><p>{language === "zh" ? "把收藏的活动分组，默认只有你能看到。" : "Group the events you save. New collections are private by default."}</p></header>
    <section className="account-section"><h2>{language === "zh" ? "新建清单" : "New collection"}</h2><form onSubmit={(event) => void create(event)}><label>{language === "zh" ? "名称" : "Name"}<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required /></label><label className="account-check"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />{language === "zh" ? "公开这个清单" : "Make this collection public"}</label><button type="submit" disabled={busy}>{language === "zh" ? "创建" : "Create collection"}</button></form>{error && <p role="alert" className="account-error">{error}</p>}</section>
    <section className="account-section"><h2>{language === "zh" ? "已有清单" : "Your collections"}</h2>{state === "loading" && <p role="status">{language === "zh" ? "加载中…" : "Loading…"}</p>}{state === "error" && <p role="alert">{language === "zh" ? "无法读取清单。" : "Could not load collections."} <button type="button" onClick={() => { setState("loading"); setRetry((value) => value + 1); }}>{language === "zh" ? "重试" : "Retry"}</button></p>}{state === "ready" && collections.length === 0 && <p>{language === "zh" ? "还没有清单，先建一个吧。" : "No collections yet. Create one above."}</p>}{state === "ready" && <ul className="collection-list">{collections.map((item) => <CollectionRow key={item.id} collection={item} language={language} onChanged={(changed) => setCollections((items) => items.map((current) => current.id === changed.id ? changed : current))} onDeleted={(id) => setCollections((items) => items.filter((current) => current.id !== id))} />)}</ul>}</section>
  </div>;
}
