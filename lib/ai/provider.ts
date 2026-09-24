import type { EventIntentQuery } from "./intent-parser";
import { parseEventIntent } from "./intent-parser";

export interface EventIntentProvider {
  parse(input: string, now: Date): Promise<EventIntentQuery>;
}

export const deterministicIntentProvider: EventIntentProvider = {
  async parse(input, now) { return parseEventIntent(input, now); },
};
