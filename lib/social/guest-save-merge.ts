import { parseEventId } from "../event-id";

export function mergeSavedEventIds(cloudIds: string[], guestIds: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const candidate of [...cloudIds, ...guestIds]) {
    const id = parseEventId(candidate);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}
