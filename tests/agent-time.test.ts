import { expect, it } from "vitest";
import { matchesTimeWindow, localMinute, aucklandMinute } from "../lib/ask/time-window";
import { EMPTY_FILTERS } from "../lib/ask/schema";

it("morning start boundary at minute 0", () => { expect(matchesTimeWindow(0, { ...EMPTY_FILTERS, timeOfDay: "morning" })).toBe(true); });
