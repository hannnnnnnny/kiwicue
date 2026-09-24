"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

type Notification = { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string };

export function NotificationsPageContent() {
  const { user, loading, enabled } = useAuth();
  const { language } = useLanguage();
  const [items, setItems] = useState<Notification[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    client.from("notifications").select("id,title,body,url,read_at,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .range(page * 20, page * 20 + 20).then(({ data, error }) => {
        if (!active) return;
        if (error) { setState("error"); return; }
        setMore((data ?? []).length > 20);
        setItems(((data ?? []).slice(0, 20)) as Notification[]);
        setState("ready");
      });
    return () => { active = false; };
  }, [user, page]);

  async function markRead(id: string) {
    const client = supabaseBrowser();
    if (!client || !user || busy) return;
    setBusy(id);
    const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", user.id);
    setBusy(null);
    if (error) { setState("error"); return; }
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
  }

  if (loading) return <div className="account-settings" role="status">{language === "zh" ? "正在读取账号…" : "Loading account…"}</div>;
  if (!enabled) return <div className="account-settings" role="alert">{language === "zh" ? "通知尚未配置。" : "Notifications are not configured yet."}</div>;
  if (!user) return <div className="account-settings"><h1>{language === "zh" ? "通知" : "Notifications"}</h1><Link href="/login?next=/notifications">{language === "zh" ? "登录" : "Log in"}</Link></div>;
  return <div className="account-settings"><header><p className="eyebrow">KiwiCue / Updates</p><h1>{language === "zh" ? "通知" : "Notifications"}</h1></header>
    <section className="account-section">{state === "loading" && <p role="status">{language === "zh" ? "加载中…" : "Loading notifications…"}</p>}
      {state === "error" && <p role="alert">{language === "zh" ? "通知暂时不可用，请刷新重试。" : "Notifications are temporarily unavailable. Refresh to retry."}</p>}
      {state === "ready" && items.length === 0 && <p>{language === "zh" ? "还没有通知。" : "You're all caught up."}</p>}
      {state === "ready" && <ul className="notification-list">{items.map((item) => <li key={item.id} data-read={Boolean(item.read_at)}>
        <Link href={item.url}><strong>{item.title}</strong><span>{item.body}</span></Link>
        <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(language === "zh" ? "zh-NZ" : "en-NZ")}</time>
        {!item.read_at && <button type="button" disabled={Boolean(busy)} onClick={() => void markRead(item.id)}>{language === "zh" ? "标记已读" : "Mark read"}</button>}
      </li>)}</ul>}
      {state === "ready" && (page > 0 || more) && <div className="comment-pagination"><button type="button" disabled={page === 0} onClick={() => { setState("loading"); setPage((value) => value - 1); }}>{language === "zh" ? "上一页" : "Previous"}</button><button type="button" disabled={!more} onClick={() => { setState("loading"); setPage((value) => value + 1); }}>{language === "zh" ? "下一页" : "Next"}</button></div>}
    </section></div>;
}
