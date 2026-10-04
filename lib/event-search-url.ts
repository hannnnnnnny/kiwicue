import type { EventCategory } from "./event-categories";
import type { EventSort, EventView } from "./event-search-params";
import type { EventWindow } from "./event-window";

export type EventSearchState = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort?: EventSort;
  /** Only free entry, filtered from the loaded events. */
  free?: boolean;
  view?: EventView;
};

export function eventSearchHref(state: EventSearchState): string {
  const params = new URLSearchParams();
  if (state.window !== "all") params.set("window", state.window);
  if (state.category) params.set("category", state.category);
  if (state.keyword) params.set("q", state.keyword);
  if (state.venueId) params.set("venue", state.venueId);
  if (state.sort === "date") params.set("sort", state.sort);
  if (state.free) params.set("free", "1");
  if (state.view === "map") params.set("view", "map");
  return `/events${params.size ? `?${params.toString()}` : ""}`;
}
