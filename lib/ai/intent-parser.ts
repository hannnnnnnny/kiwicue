import { z } from "zod";
import { EVENT_CATEGORIES, type EventCategory } from "../event-categories";
import type { KiwiCueEvent } from "../events";
import { parseEventKeyword } from "../event-search-params";
import { resolveEventWindow, type EventWindow } from "../event-window";

export const eventIntentSchema = z.object({
  query: z.string().max(100).optional(),
  categories: z.array(z.enum(EVENT_CATEGORIES)).max(5).optional(),
  dateWindow: z.enum(["7d", "weekend", "30d", "all"]).optional(),
  location: z.string().max(80).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
}).strict();
export type EventIntentQuery = z.infer<typeof eventIntentSchema>;

const terms: Record<EventCategory, RegExp> = {
  concerts: /\b(concerts?|gigs?|live music)\b|演唱会|音乐会/iu,
  theatre: /\b(theat(?:er|re)|plays?|comedy)\b|话剧|戏剧|喜剧/iu,
  markets: /\b(markets?|fairs?)\b|市集|集市/iu,
  festivals: /\b(festivals?)\b|节日|庆典/iu,
  sports: /\b(sports?|matches?|games?)\b|体育|球赛/iu,
};

export function parseEventIntent(input: string, now: Date): EventIntentQuery {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid intent anchor");
  const query = parseEventKeyword(input);
  if (!query) return {};
  const categories = EVENT_CATEGORIES.filter((category) => terms[category].test(query));
  const location = /\bCBD\b|市中心/iu.test(query) ? "CBD" : undefined;
  const dateWindow: EventWindow | undefined = /\b(this weekend|weekend)\b|本周末|周末/iu.test(query)
    ? "weekend" : /\b(next 7 days|this week)\b|未来七天|本周/iu.test(query) ? "7d" : undefined;
  const timeOfDay = /\b(morning)\b|早上|上午/iu.test(query) ? "morning"
    : /\b(afternoon)\b|下午/iu.test(query) ? "afternoon"
      : /\b(evening|tonight)\b|晚上|今晚/iu.test(query) ? "evening" : undefined;
  return eventIntentSchema.parse({ query, ...(categories.length ? { categories } : {}),
    ...(location ? { location } : {}), ...(dateWindow ? { dateWindow } : {}),
    ...(timeOfDay ? { timeOfDay } : {}) });
}

export function searchEventsWithIntent(events: KiwiCueEvent[], intent: EventIntentQuery, now = new Date()): KiwiCueEvent[] {
  const parsed = eventIntentSchema.parse(intent);
  const window = resolveEventWindow(parsed.dateWindow ?? "all", now);
  let keyword = parsed.query ?? "";
  for (const category of parsed.categories ?? []) keyword = keyword.replace(new RegExp(terms[category].source, "giu"), " ");
  keyword = keyword.replace(/\b(CBD|this weekend|weekend|next 7 days|this week|morning|afternoon|evening|tonight|in|the)\b|市中心|本周末|周末|未来七天|本周|早上|上午|下午|晚上|今晚|的/giu, " ")
    .trim().replace(/\s+/gu, " ").toLowerCase();
  return events.filter((event) => {
    const date = Date.parse(event.start.dateTime ?? `${event.start.localDate}T00:00:00Z`);
    if (!Number.isFinite(date) || date < window.start.getTime() || (window.end && date >= window.end.getTime())) return false;
    if (parsed.categories?.length && !parsed.categories.some((category) => terms[category].test(event.category))) return false;
    if (keyword && ![event.name, event.category, event.venue?.name, ...(event.tags ?? [])]
      .some((value) => value?.toLowerCase().includes(keyword))) return false;
    if (parsed.location && ![event.venue?.name, event.venue?.address, event.venue?.city].some((value) => value?.toLowerCase().includes(parsed.location!.toLowerCase()))) return false;
    if (parsed.timeOfDay && event.start.localTime) {
      const hour = Number(event.start.localTime.slice(0, 2));
      if (parsed.timeOfDay === "morning" && (hour < 5 || hour >= 12)) return false;
      if (parsed.timeOfDay === "afternoon" && (hour < 12 || hour >= 17)) return false;
      if (parsed.timeOfDay === "evening" && hour < 17) return false;
    }
    return true;
  });
}
