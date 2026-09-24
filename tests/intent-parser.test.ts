import { describe, expect, it } from "vitest";
import { parseEventIntent, searchEventsWithIntent } from "../lib/ai/intent-parser";
import { makeEvent } from "./fixtures/social-event";

describe("provider-neutral event intent", () => {
  it("extracts only supported filters from a bilingual query", () => {
    expect(parseEventIntent("本周末 CBD 的演唱会", new Date("2026-09-23T00:00:00Z"))).toMatchObject({
      categories: ["concerts"], location: "CBD", dateWindow: "weekend",
    });
  });

  it("does not pretend to know unsupported prices or availability", () => {
    const intent = parseEventIntent("cheap tickets and parking", new Date("2026-09-23T00:00:00Z"));
    expect(intent).not.toHaveProperty("price");
    expect(intent.query).toContain("cheap tickets");
  });
  it("applies a remaining artist keyword to real event names", () => {
    const events = [{ ...makeEvent("laufey"), name: "Laufey Live" }, { ...makeEvent("other"), name: "Other Show" }];
    const intent = parseEventIntent("Laufey", new Date("2026-09-23T00:00:00Z"));
    expect(searchEventsWithIntent(events, intent, new Date("2026-09-23T00:00:00Z")).map((event) => event.id)).toEqual(["laufey"]);
  });
});
