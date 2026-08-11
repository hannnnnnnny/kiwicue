import { describe, expect, it } from "vitest";
import { formatEventPrice, normalizePriceRanges } from "../lib/event-price";

describe("event price ranges", () => {
  it.each([
    [{ currency: "NZD", minimum: 49, maximum: 49 }, "en", "NZ$49"],
    [{ currency: "NZD", minimum: 49, maximum: 129 }, "en", "NZ$49–129"],
    [{ currency: "NZD", minimum: 49.5, maximum: 129.95 }, "en", "NZ$49.5–129.95"],
    [{ currency: "AUD", minimum: 20, maximum: 30 }, "zh", "A$20–30"],
    [{ currency: "CAD", minimum: 20, maximum: 20 }, "en", "CAD 20"],
  ] as const)("formats %o in %s as %s", (range, language, expected) => {
    expect(formatEventPrice(range, language)).toBe(expected);
  });

  it("localizes a missing upstream price without estimating one", () => {
    expect(formatEventPrice(null, "en")).toBe("Price on official site");
    expect(formatEventPrice(null, "zh")).toBe("价格以官网为准");
  });

  it("normalizes the first valid standard Ticketmaster price range", () => {
    expect(normalizePriceRanges([
      { type: "resale", currency: "NZD", min: 100, max: 200 },
      { type: "standard", currency: "nzd", min: 49.5, max: 129.95 },
    ])).toEqual({ currency: "NZD", minimum: 49.5, maximum: 129.95 });
  });

  it.each([
    null,
    {},
    [],
    [{ type: "standard", currency: "NZD", min: -1, max: 10 }],
    [{ type: "standard", currency: "NZD", min: 20, max: 10 }],
    [{ type: "standard", currency: "NZ", min: 10, max: 20 }],
    [{ type: "standard", currency: "NZD", min: "10", max: 20 }],
    [{ type: "standard", currency: "NZD", min: 10, max: Number.POSITIVE_INFINITY }],
  ])("rejects an unsafe or malformed range: %o", (input) => {
    expect(normalizePriceRanges(input)).toBeNull();
  });
});
