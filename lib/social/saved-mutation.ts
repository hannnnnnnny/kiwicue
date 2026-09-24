import { toBookmark, type EventBookmark } from "../bookmarks";
import type { KiwiCueEvent } from "../events";

export function parseSavedMutation(value: unknown): EventBookmark | null {
  if (typeof value !== "object" || value === null || !("event" in value)) return null;
  try {
    return toBookmark(value.event as KiwiCueEvent);
  } catch {
    return null;
  }
}
