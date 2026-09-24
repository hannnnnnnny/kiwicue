"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "../app/events/event-card";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";
import { rankForYou, type RankedEvent } from "../lib/social/for-you-ranking";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useBookmarks } from "./bookmark-provider";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

function reasonText(item: RankedEvent, language: "en" | "zh") {
  if (item.reason === "interest") return language === "zh" ? `因为你喜欢 ${item.matchedInterest}` : `Because you like ${item.matchedInterest?.replaceAll("-", " ")}`;
  if (item.reason === "saved-similarity") return language === "zh" ? "与你收藏的活动类别相似" : "Similar to events you saved";
  if (item.reason === "soon") return language === "zh" ? "近期即将举办" : "Happening soon";
  return language === "zh" ? "接下来值得看看" : "Upcoming in Auckland";
}

export function ForYouContent() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const { bookmarks } = useBookmarks();
  const [events, setEvents] = useState<KiwiCueEvent[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setState("loading");
      try {
        const response = await fetch("/api/events?window=30d&size=50", { cache: "no-store" });
        if (!response.ok) throw new Error("events unavailable");
        const payload = await response.json() as AucklandEventsResult;
        if (!Array.isArray(payload.events)) throw new Error("invalid event feed");
        if (active) { setEvents(payload.events); setState("ready"); }
      } catch { if (active) setState("error"); }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    Promise.all([
      client.from("user_interests").select("interest_id").eq("user_id", user.id),
      client.from("interests").select("id,slug"),
    ]).then(([selected, catalog]) => {
      if (!active || selected.error || catalog.error) return;
      const selectedIds = new Set((selected.data as { interest_id: string }[]).map(({ interest_id }) => interest_id));
      setInterests((catalog.data as { id: string; slug: string }[]).filter(({ id }) => selectedIds.has(id)).map(({ slug }) => slug));
    });
    return () => { active = false; };
  }, [user]);

  const ranked = useMemo(() => rankForYou(events, {
    interests: user ? interests : [], savedCategories: bookmarks.map(({ event }) => event.category),
  }, new Date()).slice(0, 24), [bookmarks, events, interests, user]);
  return <main className="for-you-page">
    <PortalHeader currentPage="for-you" />
    <div className="for-you-content">
      <header><p className="eyebrow">KiwiCue / Auckland</p><h1>{language === "zh" ? "为你发现" : "For You"}</h1><p>{language === "zh" ? "根据你主动选择的兴趣与收藏，从真实活动中排序；不是 AI 猜测。" : "Real Auckland events ordered by interests you choose and events you save. No invented picks."}</p></header>
      {!user && <p className="for-you-hint">{language === "zh" ? "登录并选择兴趣，推荐会更贴近你。" : "Log in and choose interests to make these picks more relevant."} <Link href="/login?next=/for-you">{language === "zh" ? "登录" : "Log in"}</Link></p>}
      {state === "loading" && <p role="status">{language === "zh" ? "正在寻找活动…" : "Finding events…"}</p>}
      {state === "error" && <section role="alert"><p>{language === "zh" ? "活动暂时无法读取。" : "Events are temporarily unavailable."}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{language === "zh" ? "重试" : "Retry"}</button></section>}
      {state === "ready" && ranked.length === 0 && <section><p>{language === "zh" ? "目前没有符合条件的未来活动。" : "No upcoming events are available right now."}</p><Link href="/events">{language === "zh" ? "浏览全部活动" : "Browse all events"}</Link></section>}
      {state === "ready" && ranked.length > 0 && <ol className="event-grid for-you-grid">{ranked.map((item, index) => <li key={item.event.id}><p className="for-you-reason">{reasonText(item, language)}</p><EventCard event={item.event} index={index} language={language} /></li>)}</ol>}
    </div>
  </main>;
}
