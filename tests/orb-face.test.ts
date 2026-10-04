import { describe, expect, it } from "vitest";
import { faceFor } from "../components/ask/orb-face";

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
