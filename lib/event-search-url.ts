import type { EventCategory } from "./event-categories";
import type { EventSort } from "./event-search-params";
import type { EventWindow } from "./event-window";

export type EventSearchState = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort?: EventSort;
};

export function eventSearchHref(state: EventSearchState): string {
  const params = new URLSearchParams();
  if (state.window !== "all") params.set("window", state.window);
  if (state.category) params.set("category", state.category);
  if (state.keyword) params.set("q", state.keyword);
  if (state.venueId) params.set("venue", state.venueId);
  if (state.sort === "date") params.set("sort", state.sort);
  return `/events${params.size ? `?${params.toString()}` : ""}`;
}
