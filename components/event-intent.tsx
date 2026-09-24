"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { KiwiCueEvent } from "../lib/events";
import { eventStatusInput } from "../lib/social/validation";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";
import { trackActivity } from "../lib/social/activity";

type Status = "interested" | "going" | "went" | null;

export function EventIntent({ event }: { event: KiwiCueEvent }) {
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const client = supabaseBrowser();
    if (!client || !user) return;
    let active = true;
    client.from("event_user_status").select("status").eq("user_id", user.id)
      .eq("event_id", event.id).maybeSingle().then(({ data }) => {
        if (active) setStatus(eventStatusInput.safeParse(data?.status).data ?? null);
      });
    return () => { active = false; };
  }, [event.id, user]);

  async function choose(next: Exclude<Status, null>) {
    const client = supabaseBrowser();
    if (!client || !user || pending) return;
    const previous = status;
    const selected = status === next ? null : next;
    setStatus(selected); setPending(true); setError(false);
    const { error: updateError } = selected
      ? await client.from("event_user_status").upsert({ user_id: user.id, event_id: event.id, status: selected })
      : await client.from("event_user_status").delete().eq("user_id", user.id).eq("event_id", event.id);
    if (updateError) { setStatus(previous); setError(true); }
    else if (selected) void trackActivity({ action: selected === "interested" ? "event_interested" : selected === "going" ? "event_going" : "event_went", eventId: event.id });
    setPending(false);
  }

  if (loading || !supabaseBrowser()) return null;
  if (!user) return <p className="event-intent-prompt"><Link href={`/login?next=/events/${encodeURIComponent(event.id)}`}>{language === "zh" ? "登录后标记想去" : "Log in to mark your plans"}</Link></p>;
  const options = [
    { value: "interested", en: "Interested", zh: "感兴趣" },
    { value: "going", en: "Going", zh: "准备去" },
    { value: "went", en: "Went", zh: "去过" },
  ] as const;
  return <div className="event-intent">
    <p>{language === "zh" ? "你的计划" : "Your plans"}</p>
    <div>{options.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} disabled={pending} onClick={() => void choose(option.value)}>{option[language]}</button>)}</div>
    {error && <small role="alert">{language === "zh" ? "未保存，请重试。" : "Could not save. Try again."}</small>}
  </div>;
}
