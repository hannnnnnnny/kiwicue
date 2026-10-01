"use client";

import { byStartTime } from "../../lib/ask/card-order";
import type { AskCard, AskLayout } from "../../lib/ask/schema";
import { AskResultCard } from "./ask-result-card";

type Language = "en" | "zh";
const SPOTLIGHT_EXTRAS = 2;
const copy = {
  en: { more: "Also worth a look", kinds: { event: "Events", movie: "Movies", market: "Markets" } },
  zh: { more: "也可以看看", kinds: { event: "活动", movie: "电影", market: "市集" } },
} as const;

function timeLabel(card: AskCard, language: Language): string {
  const date = new Date(card.when);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", { timeZone: "Pacific/Auckland", hour: "numeric", minute: "2-digit" }).format(date);
}

type CardsProps = { cards: AskCard[]; bestId: string | null; layout: AskLayout | null; language: Language; onSound?(): void };

function List({ cards, language }: { cards: AskCard[]; language: Language }) {
  return <ol className="ask-list">{cards.map((card, index) => (
    <li key={card.id} style={{ animationDelay: `${Math.min(index, 12) * 80}ms` }}><AskResultCard card={card} best={false} language={language} /></li>
  ))}</ol>;
}

/** An itinerary: everything in time order with the time beside it. */
function Timeline({ cards, language }: { cards: AskCard[]; language: Language }) {
  return <ol className="ask-timeline">{[...cards].sort(byStartTime).map((card) => (
    <li key={card.id}><time dateTime={card.when}>{timeLabel(card, language)}</time><AskResultCard card={card} best={false} language={language} /></li>
  ))}</ol>;
}

/** Rows by kind that scroll sideways, for browsing a mixed bag. */
function Shelf({ cards, language }: { cards: AskCard[]; language: Language }) {
  const kinds = (["event", "movie", "market"] as const).filter((kind) => cards.some((card) => card.kind === kind));
  return <div className="ask-shelf">{kinds.map((kind) => (
    <section key={kind} aria-label={copy[language].kinds[kind]}>
      <h3>{copy[language].kinds[kind]}</h3>
      <ul>{cards.filter((card) => card.kind === kind).map((card) => <li key={card.id}><AskResultCard card={card} best={false} language={language} /></li>)}</ul>
    </section>
  ))}</div>;
}

/** The cards, laid out the way the assistant chose for what it found. */
export function AskCards({ cards, bestId, layout, language, onSound }: CardsProps) {
  if (cards.length === 0) return null;
  const best = cards.find((card) => card.id === bestId) ?? null;
  const others = cards.filter((card) => card !== best);
  if (layout === "timeline") return <div className="ask-cards" data-layout="timeline"><Timeline cards={cards} language={language} /></div>;
  if (layout === "shelf" && cards.length > 3) return <div className="ask-cards" data-layout="shelf"><Shelf cards={cards} language={language} /></div>;
  const spotlight = layout === "spotlight" && best !== null;
  return (
    <div className="ask-cards" data-layout={spotlight ? "spotlight" : "grid"}>
      {best ? <AskResultCard card={best} best language={language} onSound={onSound} /> : null}
      {spotlight && others.length > 0 ? <p className="ask-more">{copy[language].more}</p> : null}
      {others.length > 0 ? <List cards={spotlight ? others.slice(0, SPOTLIGHT_EXTRAS) : others} language={language} /> : null}
    </div>
  );
}
