"use client";

import Link from "next/link";
import { useState } from "react";
import type { AskCard } from "../../lib/ask/schema";
import { EventImage } from "../event-image";

type Language = "en" | "zh";
type Mode = "muted" | "poster" | "sound";
const TRAILER_KEY = /^[A-Za-z0-9_-]{11}$/u;
const copy = {
  en: { trailer: (title: string) => `${title} trailer`, soundOn: "Sound on", play: "Play trailer" },
  zh: { trailer: (title: string) => `${title} 预告片`, soundOn: "打开声音", play: "播放预告片" },
} as const;

/** Autoplay only when the visitor hasn't asked for less motion or less data. */
function canAutoplay(): boolean {
  if (typeof window === "undefined") return false;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return !reduced && !saveData;
}

function embedUrl(key: string, muted: boolean): string {
  const params = new URLSearchParams({ autoplay: "1", mute: muted ? "1" : "0", playsinline: "1", rel: "0" });
  // A single video loops only when it is also its own playlist.
  if (muted) { params.set("loop", "1"); params.set("playlist", key); }
  return `https://www.youtube-nocookie.com/embed/${key}?${params}`;
}

function Trailer({ card, trailerKey, language, onSound }: { card: AskCard; trailerKey: string; language: Language; onSound?(): void }) {
  const content = copy[language];
  const [mode, setMode] = useState<Mode>(() => canAutoplay() ? "muted" : "poster");
  const withSound = () => { setMode("sound"); onSound?.(); };
  if (mode === "poster") {
    return (
      <button type="button" className="ask-card-play" aria-label={content.play} onClick={withSound}>
        <EventImage src={card.imageUrl} alt="" fallback={null} loading="eager" />
        <span aria-hidden="true">▶</span>
      </button>
    );
  }
  return (
    <>
      <iframe key={mode} src={embedUrl(trailerKey, mode === "muted")} title={content.trailer(card.title)}
        allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      {mode === "muted" ? <button type="button" className="ask-card-sound" onClick={withSound}><span aria-hidden="true">🔊 </span>{content.soundOn}</button> : null}
    </>
  );
}

/** The best match's 16:9 lead: a movie trailer when there is one, otherwise its picture. */
export function AskCardHero({ card, language, onSound }: { card: AskCard; language: Language; onSound?(): void }) {
  const trailerKey = card.trailerKey && TRAILER_KEY.test(card.trailerKey) ? card.trailerKey : null;
  if (!trailerKey && !card.imageUrl) return null;
  return (
    <div className="ask-card-hero" data-kind={card.kind}>
      {trailerKey
        ? <Trailer card={card} trailerKey={trailerKey} language={language} onSound={onSound} />
        : <Link href={card.href} tabIndex={-1} aria-hidden="true"><EventImage src={card.imageUrl} alt="" fallback={null} loading="eager" /></Link>}
    </div>
  );
}
