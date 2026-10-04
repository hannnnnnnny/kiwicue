import { describe, expect, it } from "vitest";
import { faceFor, pointerGaze } from "../components/ask/orb-face";

describe("faceFor", () => {
  it("gives every work state its own pose", () => {
    expect(faceFor("searching", null)).toMatchObject({ scan: 1, follow: 0 });
    expect(faceFor("thinking", null)).toMatchObject({ Squint: 0.55, lookY: 0.55 });
    expect(faceFor("sleeping", null)).toMatchObject({ Blink: 0.92, follow: 0 });
    expect(faceFor("error", null).impulse).toBe("shake");
    expect(faceFor("idle", null)).toMatchObject({ Wide: 0, Squint: 0, scan: 0, follow: 1, impulse: null });
  });

  it("shows the mood while idle or talking, and keeps the talking bob", () => {
    expect(faceFor("idle", "sorry")).toMatchObject({ HalfBlink: 0.5, sink: 0.7 });
    expect(faceFor("speaking", "happy")).toMatchObject({ Squint: 0.6, hop: 0.6, bob: 1 });
    expect(faceFor("speaking", "excited").impulse).toBe("pop");
  });

  it("lets work states win over a leftover mood", () => {
    expect(faceFor("listening", "sorry")).toEqual(faceFor("listening", null));
    expect(faceFor("searching", "excited")).toEqual(faceFor("searching", null));
  });
});

describe("pointerGaze", () => {
  const orb = { left: 100, top: 100, width: 100, height: 100 } as DOMRect;
  const viewport = { width: 1000, height: 800 };
  it("points the eyes at the pointer, up being positive, within -1…1", () => {
    expect(pointerGaze({ x: 150, y: 150 }, orb, viewport)).toEqual({ x: 0, y: 0 });
    expect(pointerGaze({ x: 650, y: 150 }, orb, viewport)).toEqual({ x: 1, y: 0 });
    expect(pointerGaze({ x: 150, y: 0 }, orb, viewport).y).toBeCloseTo(0.375);
    expect(pointerGaze({ x: 5000, y: 5000 }, orb, viewport)).toEqual({ x: 1, y: -1 });
  });
});
