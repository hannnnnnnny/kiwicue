"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent } from "../lib/events";
import { rankForYou } from "../lib/social/for-you-ranking";
import { supabaseBrowser, useAuth } from "./auth-provider";
import { useLanguage } from "./language-provider";

const MAX_PERSONAL = 8;

function useInterests(): string[] {
  const { user } = useAuth();
  const [interests, setInterests] = useState<{ userId: string; slugs: string[] } | null>(null);
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
      setInterests({ userId: user.id, slugs: (catalog.data as { id: string; slug: string }[]).filter(({ id }) => selectedIds.has(id)).map(({ slug }) => slug) });
    });
    return () => { active = false; };
  }, [user]);
  return user && interests?.userId === user.id ? interests.slugs : [];
}

/**
 * The part of For You that follows interests the visitor chose in their account. Without an
 * account it invites them to choose some; the editorial picks below work for everyone.
 */
export function PersonalPicks({ events }: { events: KiwiCueEvent[] }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const interests = useInterests();
  const zh = language === "zh";
  const matched = useMemo(() => rankForYou(events, { interests, savedCategories: [] }, new Date())
    .filter((item) => item.reason === "interest").slice(0, MAX_PERSONAL), [events, interests]);
  if (!user) {
    return <p className="for-you-hint">{zh ? "登录并选择兴趣，推荐会更贴近你。" : "Log in and choose interests to make these picks more relevant."} <Link href="/login?next=/for-you">{zh ? "登录" : "Log in"}</Link></p>;
  }
  if (matched.length === 0) return null;
  return (
    <section className="recommendation-section for-you-personal" aria-labelledby="for-you-personal-title">
      <h2 id="for-you-personal-title">{zh ? "按你的兴趣" : "From your interests"}</h2>
      <ol className="event-grid for-you-grid">
        {matched.map((item, index) => (
          <li key={item.event.id}>
            <p className="for-you-reason">{zh ? `因为你喜欢 ${item.matchedInterest}` : `Because you like ${item.matchedInterest?.replaceAll("-", " ")}`}</p>
            <EventCard event={item.event} index={index} language={language} />
          </li>
        ))}
      </ol>
    </section>
  );
}
