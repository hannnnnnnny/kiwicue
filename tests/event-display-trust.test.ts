import { describe, expect, it } from "vitest";
import { formatEventStatusForDisplay, isEventSourceFresh } from "../lib/event-display";
import type { KiwiCueEvent } from "../lib/events";

const market = {
  id: "kc-market-grey-lynn",
  name: "Grey Lynn Farmers Market",
  url: "https://www.greylynnfarmersmarket.co.nz/",
  imageUrl: null,
  start: { localDate: "2026-09-06", localTime: "08:30:00", dateTime: "2026-09-05T20:30:00Z", timezone: "Pacific/Auckland" },
  status: "schedule_verified",
  category: "Market",
  venue: null,
  source: { name: "Grey Lynn Farmers Market", url: "https://www.greylynnfarmersmarket.co.nz/", verifiedAt: "2026-08-12", provenance: "recurring-schedule" as const },
} satisfies KiwiCueEvent;

describe("event trust display", () => {
  it("normalizes US and UK cancellation spellings", () => {
    expect(formatEventStatusForDisplay({ ...market, id: "event-canceled", status: "canceled", category: "Music" }, "en")).toBe("Canceled");
    expect(formatEventStatusForDisplay({ ...market, id: "event-canceled", status: "canceled", category: "Music" }, "zh")).toBe("已取消");
  });

  it("calls recurring dates expected schedules instead of verified occurrences", () => {
    expect(formatEventStatusForDisplay(market, "en", new Date("2026-08-31T00:00:00Z"))).toBe("Expected schedule");
    expect(formatEventStatusForDisplay(market, "zh", new Date("2026-08-31T00:00:00Z"))).toBe("预计日程");
  });

  it("labels old recurring source metadata stale", () => {
    expect(isEventSourceFresh("2026-01-01", new Date("2026-08-31T00:00:00Z"))).toBe(false);
    expect(formatEventStatusForDisplay({ ...market, source: { ...market.source, verifiedAt: "2026-01-01" } }, "en", new Date("2026-08-31T00:00:00Z"))).toBe("Schedule reference may be stale");
  });
});
