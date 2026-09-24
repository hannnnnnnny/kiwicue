"use client";

import { useEffect, useState } from "react";
import type { Language } from "./language-provider";
import { supabaseBrowser } from "./auth-provider";

export function EventSocialProof({ eventId, language }: { eventId: string; language: Language }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const client = supabaseBrowser();
    if (!client) return;
    let active = true;
    client.from("event_user_status").select("event_id", { count: "exact", head: true })
      .eq("event_id", eventId).eq("status", "going").then(({ count: visibleCount, error }) => {
        if (active && !error) setCount(visibleCount ?? 0);
      });
    return () => { active = false; };
  }, [eventId]);

  if (!count) return null;
  return <p className="event-social-proof">{language === "zh"
    ? `${count} 人公开表示准备参加`
    : `${count} ${count === 1 ? "person" : "people"} publicly going`}</p>;
}
