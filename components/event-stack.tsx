import Link from "next/link";
import { EventImage } from "./event-image";
import { eventDisplayName } from "../lib/event-display";
import type { KiwiCueEvent } from "../lib/events";
import { groupEventSeries } from "../lib/event-series";
import type { Language } from "./language-provider";

/** A preview of a filtered list; it opens that list. */
export function EventStack({ title, events, language, href }: { title: string; events: KiwiCueEvent[]; language: Language; href: string }) {
  if (!events.length) return null;
  const leads = groupEventSeries(events).map(({ lead }) => lead);
  const count = language === "zh"
    ? `${leads.length} 个活动${leads.length < events.length ? ` · ${events.length} 场` : ""}`
    : `${leads.length} ${leads.length === 1 ? "event" : "events"}${leads.length < events.length ? ` · ${events.length} sessions` : ""}`;
  return <section className="discovery-collection">
    <header><h2>{title}</h2><Link href={href} replace>{language === "zh" ? "查看全部" : "See all"} <span aria-hidden="true">↗</span></Link></header>
    <Link className="event-stack" href={href} replace aria-label={`${title} · ${count}`}>
      {leads.slice(0, 3).reverse().map((event, index, layers) => <span className="event-stack-layer" data-depth={layers.length - 1 - index} key={event.id} aria-hidden="true">
        <EventImage src={event.editorialPreview?.image?.url ?? event.imageUrl} alt="" fallback={<span className="discovery-image-fallback">{eventDisplayName(event, language)}</span>} />
      </span>)}
      <span className="event-stack-caption"><strong>{eventDisplayName(leads[0], language)}</strong><span>{count} · {language === "zh" ? "点开探索" : "Open collection"}</span></span>
    </Link>
  </section>;
}
