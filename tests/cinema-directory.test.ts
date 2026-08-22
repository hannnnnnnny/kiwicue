import { describe, expect, it } from "vitest";
import {
  AUCKLAND_CINEMAS,
  filterCinemas,
  sortCinemasByDistance,
} from "../lib/cinema-directory";

describe("Auckland cinema directory", () => {
  it("contains unique ids, official HTTPS links, and plausible Auckland coordinates", () => {
    expect(AUCKLAND_CINEMAS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(AUCKLAND_CINEMAS.map((cinema) => cinema.id)).size).toBe(AUCKLAND_CINEMAS.length);

    for (const cinema of AUCKLAND_CINEMAS) {
      expect(new URL(cinema.sessionsUrl).protocol).toBe("https:");
      expect(cinema.coordinates.latitude).toBeGreaterThan(-37.2);
      expect(cinema.coordinates.latitude).toBeLessThan(-36.5);
      expect(cinema.coordinates.longitude).toBeGreaterThan(174.4);
      expect(cinema.coordinates.longitude).toBeLessThan(175.2);
    }
  });

  it("uses bounded local brand assets with deterministic fallbacks", () => {
    for (const cinema of AUCKLAND_CINEMAS) {
      expect(cinema.brandLabel).toMatch(/^[A-Z0-9]{1,3}$/);
      expect(cinema.brandAsset === null || /^\/cinemas\/[a-z-]+\.(?:png|svg)$/.test(cinema.brandAsset)).toBe(true);
    }
    expect(AUCKLAND_CINEMAS.find(({ id }) => id === "silky-otter-orakei")?.brandAsset).toBeNull();
  });

  it("matches name, chain, suburb, and address without case or diacritic sensitivity", () => {
    expect(filterCinemas(AUCKLAND_CINEMAS, "academy").map((cinema) => cinema.id)).toContain("academy");
    expect(filterCinemas(AUCKLAND_CINEMAS, "HOYTS").every((cinema) => cinema.chain === "HOYTS")).toBe(true);
    expect(filterCinemas(AUCKLAND_CINEMAS, "newmarket").length).toBeGreaterThan(0);
    expect(filterCinemas(AUCKLAND_CINEMAS, "orakei").map((cinema) => cinema.id)).toContain("silky-otter-orakei");
    expect(filterCinemas(AUCKLAND_CINEMAS, "queen street").length).toBeGreaterThan(0);
  });

  it("keeps the curated order for a blank query", () => {
    expect(filterCinemas(AUCKLAND_CINEMAS, "   ")).toEqual(AUCKLAND_CINEMAS);
  });

  it("adds straight-line distance and sorts nearest first without mutating the directory", () => {
    const originalFirst = AUCKLAND_CINEMAS[0];
    const result = sortCinemasByDistance(AUCKLAND_CINEMAS, {
      latitude: -36.8514,
      longitude: 174.7654,
    });

    expect(result[0].id).toBe("academy");
    expect(result[0].distanceKilometres).toBeLessThan(0.1);
    expect(result.at(-1)?.distanceKilometres).toBeGreaterThan(result[0].distanceKilometres);
    expect(AUCKLAND_CINEMAS[0]).toBe(originalFirst);
  });
});
