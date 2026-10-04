import Link from "next/link";
import type { AskCard } from "../../lib/ask/schema";
import { EventImage } from "../event-image";
import { AskCardHero } from "./ask-card-hero";
import { trustedBookingUrl } from "../../lib/ask/booking";

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

const KIND_ICON = { event: "🎫", movie: "🎬", market: "🧺" } as const;

export function AskResultCard({ card, best, language, onSound }: { card: AskCard; best: boolean; language: Language; onSound?(): void }) {
  const content = copy[language];
  return (
    <article className="ask-card" data-best={best || undefined} aria-label={best ? `${content.best}: ${card.title}` : card.title}>
      {best ? <AskCardHero card={card} language={language} onSound={onSound} /> : null}
      <Link href={card.href} className="ask-card-link">
        {best ? null : (
          <span className="ask-card-thumb">
            <EventImage src={card.imageUrl} alt="" fallback={<span className="ask-card-thumb-empty" aria-hidden="true">{KIND_ICON[card.kind]}</span>} />
          </span>
        )}
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
      <div className="ask-card-actions">
        <span className="ask-price-note">{card.budgetStatus === "free"
          ? language === "zh" ? "免费入场；餐饮交通另计" : "Free entry; food and travel extra"
          : card.minPartyCost != null
          ? language === "zh" ? `全组至少 $${card.minPartyCost}；票种及费用待确认` : `Party from $${card.minPartyCost}; ticket types and fees unconfirmed`
          : language === "zh" ? "价格未知；预算未核实" : "Price unknown; budget unverified"}</span>
        {trustedBookingUrl(card.bookingUrl) ? <a href={trustedBookingUrl(card.bookingUrl)!} target="_blank" rel="noopener noreferrer"
          className="ask-booking" aria-label={language === "zh" ? `${card.title} 官方订票` : `Book ${card.title} on the official site`}>
          {language === "zh" ? "官方订票 ↗" : "Official booking ↗"}
        </a> : null}
      </div>
    </article>
  );
}
