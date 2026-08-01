import type { EventCategory } from "./event-categories";
import type { EventWindow } from "./event-window";

export type EventSearchState = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
};

export function eventSearchHref(state: EventSearchState): string {
  const params = new URLSearchParams();
  if (state.window !== "all") params.set("window", state.window);
  if (state.category) params.set("category", state.category);
  if (state.keyword) params.set("q", state.keyword);
  if (state.venueId) params.set("venue", state.venueId);
  return `/events${params.size ? `?${params.toString()}` : ""}`;
}
