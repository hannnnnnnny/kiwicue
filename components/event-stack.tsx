import { EventImage } from "./event-image";
import { eventDisplayName } from "../lib/event-display";
import type { KiwiCueEvent } from "../lib/events";
import type { Language } from "./language-provider";

export function EventStack({ title, events, language, onOpen }: { title: string; events: KiwiCueEvent[]; language: Language; onOpen: () => void }) {
  if (!events.length) return null;
  return <section className="discovery-collection">
    <header><h2>{title}</h2><button onClick={onOpen}>{language === "zh" ? "查看全部" : "See all"} <span aria-hidden="true">↗</span></button></header>
    <button className="event-stack" onClick={onOpen} aria-label={`${title} · ${events.length} ${language === "zh" ? "个已加载活动" : "loaded events"}`}>
      {events.slice(0, 3).reverse().map((event, index, layers) => <span className="event-stack-layer" data-depth={layers.length - 1 - index} key={event.id} aria-hidden="true">
        <EventImage src={event.editorialPreview?.image?.url ?? event.imageUrl} alt="" fallback={<span className="discovery-image-fallback">{eventDisplayName(event, language)}</span>} />
      </span>)}
      <span className="event-stack-caption"><strong>{eventDisplayName(events[0], language)}</strong><span>{events.length} {language === "zh" ? "个已加载活动 · 点开探索" : "loaded events · Open collection"}</span></span>
    </button>
  </section>;
}
