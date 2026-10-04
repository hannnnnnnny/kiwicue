import type { AskMood } from "../../lib/ask/mood";

/** What the assistant is doing. Work states win over moods; moods colour idle and speaking. */
export type BotState = "idle" | "listening" | "thinking" | "searching" | "speaking" | "error" | "sleeping";

/**
 * One pose of the orb. Eye shapes are the models' own morph targets (0–1); the rest are
 * motions the scene layers on top of the designed Idle animation.
 */
export type Face = {
  Wide: number; Squint: number; HalfBlink: number; Blink: number;
  /** Where the eyes rest, -1…1, before the pointer pulls them. Positive y looks up. */
  lookX: number; lookY: number;
  /** How much the eyes follow the pointer, 0–1. */
  follow: number;
  /** Eyes sweeping side to side, as if reading a list. */
  scan: number;
  tilt: number; hop: number; bob: number; sink: number;
  /** One-off moves played when the face is entered. */
  impulse: "shake" | "pop" | null;
};

const NEUTRAL: Face = {
  Wide: 0, Squint: 0, HalfBlink: 0, Blink: 0, lookX: 0, lookY: 0, follow: 1, scan: 0, tilt: 0, hop: 0, bob: 0, sink: 0, impulse: null,
};

const STATES: Record<BotState, Partial<Face>> = {
  idle: {},
  listening: { Wide: 0.7, tilt: 0.35, follow: 0.6 },
  thinking: { Squint: 0.55, HalfBlink: 0.2, lookX: 0.45, lookY: 0.55, follow: 0.15 },
  searching: { Squint: 0.3, scan: 1, lookY: -0.2, follow: 0 },
  speaking: { Wide: 0.25, bob: 1 },
  error: { HalfBlink: 0.45, lookY: -0.3, sink: 0.5, impulse: "shake" },
  sleeping: { Blink: 0.92, lookY: -0.4, sink: 0.6, follow: 0 },
};

const MOODS: Record<AskMood, Partial<Face>> = {
  happy: { Squint: 0.6, hop: 0.6 },
  excited: { Wide: 0.55, hop: 1, impulse: "pop" },
  curious: { Wide: 0.5, tilt: 1, lookY: 0.15 },
  sorry: { HalfBlink: 0.5, lookY: -0.5, sink: 0.7, tilt: -0.4 },
  surprised: { Wide: 1, impulse: "pop" },
  calm: { HalfBlink: 0.15 },
};

/** The orb's pose for a state, with the reply's mood when it isn't busy with something else. */
export function faceFor(state: BotState, mood: AskMood | null): Face {
  const moodApplies = mood !== null && (state === "idle" || state === "speaking");
  const face = { ...NEUTRAL, ...STATES[state], ...(moodApplies ? MOODS[mood] : {}) };
  // Talking keeps its bob whatever the mood.
  return state === "speaking" ? { ...face, bob: 1 } : face;
}

/** Where the pointer is relative to the orb, -1…1 each way; positive y is above it. */
export function pointerGaze(pointer: { x: number; y: number }, orb: DOMRect, viewport: { width: number; height: number }): { x: number; y: number } {
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return {
    x: clamp((pointer.x - (orb.left + orb.width / 2)) / (viewport.width / 2)),
    y: clamp(((orb.top + orb.height / 2) - pointer.y) / (viewport.height / 2)),
  };
}
