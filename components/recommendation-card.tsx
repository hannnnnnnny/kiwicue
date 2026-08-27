import { EventCard } from "../app/events/event-card";
import type { RecommendationReason } from "../lib/event-recommendations";
import type { KiwiCueEvent } from "../lib/events";
import type { Language } from "./language-provider";

const reasonCopy: Record<Language, Record<RecommendationReason, string>> = {
  en: {
    "saved-affinity": "Matches what you save",
    weekend: "Fits this weekend",
    soon: "Coming up soon",
    verified: "Official source verified",
    "well-detailed": "Easy to plan",
    upcoming: "Upcoming in Auckland",
  },
  zh: {
    "saved-affinity": "符合你的收藏偏好",
    weekend: "适合本周末",
    soon: "即将开始",
    verified: "官方来源已核实",
    "well-detailed": "信息完整，方便计划",
    upcoming: "奥克兰未来活动",
  },
};

const rankCopy: Record<Language, (position: number) => string> = {
  en: (position) => `Recommendation ${position}`,
  zh: (position) => `推荐第 ${position} 项`,
};

export function RecommendationCard({ event, index, language, reason }: {
  event: KiwiCueEvent;
  index: number;
  language: Language;
  reason: RecommendationReason;
}) {
  return (
    <div className="recommendation-card-shell">
      <p className="recommendation-reason"><i aria-hidden="true" />{reasonCopy[language][reason]}</p>
      <EventCard event={event} index={index} language={language} rankLabel={rankCopy[language]} />
    </div>
  );
}
