import { describe, expect, it } from "vitest";
import { distanceKm, formatDistanceKm } from "../lib/distance";

describe("event distance", () => {
  it("returns zero for the same point", () => {
    const point = { latitude: -36.8485, longitude: 174.7633 };
    expect(distanceKm(point, point)).toBe(0);
  });

  it("uses Haversine distance between two Auckland points", () => {
    const distance = distanceKm(
      { latitude: -36.8485, longitude: 174.7633 },
      { latitude: -36.8445, longitude: 174.7680 },
    );
    expect(distance).toBeCloseTo(0.61, 1);
  });

  it("handles antipodal points without numerical overflow", () => {
    expect(distanceKm(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 180 },
    )).toBeCloseTo(Math.PI * 6371, 5);
  });

  it.each([
    [{ latitude: Number.NaN, longitude: 0 }, { latitude: 0, longitude: 0 }],
    [{ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 }],
    [{ latitude: 0, longitude: -181 }, { latitude: 0, longitude: 0 }],
  ])("rejects invalid coordinates", (from, to) => {
    expect(() => distanceKm(from, to)).toThrow(RangeError);
  });

  it.each([
    [0, "en", "About 0.0 km away (straight line)"],
    [4.24, "en", "About 4.2 km away (straight line)"],
    [10.49, "en", "About 10 km away (straight line)"],
    [4.24, "zh", "约 4.2 公里（直线距离）"],
    [10.6, "zh", "约 11 公里（直线距离）"],
  ] as const)("formats %s km in %s", (distance, language, expected) => {
    expect(formatDistanceKm(distance, language)).toBe(expected);
  });

  it.each([Number.NaN, -1, Number.POSITIVE_INFINITY])(
    "rejects an invalid formatted distance: %s",
    (distance) => {
      expect(() => formatDistanceKm(distance, "en")).toThrow(RangeError);
    },
  );
});
