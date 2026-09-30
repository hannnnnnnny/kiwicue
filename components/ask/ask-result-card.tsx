import Link from "next/link";
import type { AskCard } from "../../lib/ask/schema";
import { EventImage } from "../event-image";

type Language = "en" | "zh";
const copy = {
  en: { best: "Best match", sessions: (count: number) => `${count} sessions`, kind: { event: "Event", movie: "Movie", market: "Market" } },
  zh: { best: "最佳匹配", sessions: (count: number) => `共 ${count} 场`, kind: { event: "活动", movie: "电影", market: "市集" } },
} as const;

function formatWhen(value: string, language: Language): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "Pacific/Auckland", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(date);
}

export function AskResultCard({ card, best, language }: { card: AskCard; best: boolean; language: Language }) {
  const content = copy[language];
  return (
    <article className="ask-card" data-best={best || undefined} aria-label={best ? `${content.best}: ${card.title}` : card.title}>
      <Link href={card.href} className="ask-card-link">
        {best ? <span className="ask-card-media"><EventImage src={card.imageUrl} alt="" fallback={null} loading="eager" /></span> : null}
        <span className="ask-card-body">
          <span className="ask-card-eyebrow">{best ? content.best : content.kind[card.kind]}</span>
          <strong className="ask-card-title">{card.title}</strong>
          <span className="ask-card-meta">{formatWhen(card.when, language)}{card.venue ? ` · ${card.venue}` : ""}</span>
          <span className="ask-card-tags">
            {card.priceText ? <span>{card.priceText}</span> : null}
            {card.sessionCount > 1 ? <span>{content.sessions(card.sessionCount)}</span> : null}
          </span>
        </span>
      </Link>
    </article>
  );
}
