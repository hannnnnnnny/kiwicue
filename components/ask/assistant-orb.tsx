"use client";

import { useEffect, useRef, useState } from "react";
import type { AskMood } from "../../lib/ask/mood";
import type { Assistant } from "../../lib/assistants";
import type { BotState } from "./orb-face";
import type { OrbScene } from "./orb-scene";

export type { BotState };

function wantsMotion(): boolean {
  return typeof window.matchMedia !== "function" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The chosen assistant. Large orbs load the 3D model (three.js is fetched only then) and show the
 * poster until it is ready, or instead of it when motion is reduced or WebGL fails. Decorative:
 * the overlay announces the same state in text.
 */
export function AssistantOrb({ assistant, state, mood = null, size = "large", active = true }: {
  assistant: Assistant; state: BotState; mood?: AskMood | null; size?: "large" | "small"; active?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<OrbScene | null>(null);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const latest = useRef({ state, mood });

  useEffect(() => {
    latest.current = { state, mood };
    scene.current?.setState(state);
    scene.current?.setMood(mood);
  }, [state, mood]);

  useEffect(() => {
    const target = canvas.current;
    if (!active || size !== "large" || !target || !wantsMotion()) return;
    let cancelled = false;
    void import("./orb-scene")
      .then(({ mountOrb }) => mountOrb(target, assistant.model))
      .then((mounted) => {
        if (cancelled) { mounted.dispose(); return; }
        scene.current = mounted;
        mounted.setState(latest.current.state);
        mounted.setMood(latest.current.mood);
        setReadyFor(assistant.id);
      })
      .catch((error: unknown) => {
        // The poster stays; 3D is decoration, so log the reason and carry on.
        console.error(JSON.stringify({ event: "assistant_orb_unavailable", name: error instanceof Error ? error.name : "unknown" }));
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [active, assistant.id, assistant.model, size]);

  const ready = readyFor === assistant.id;
  return (
    <span className="ask-orb" data-state={state} data-mood={mood ?? undefined} data-size={size} data-ready={ready || undefined} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 6 KB local poster; next/image adds nothing here */}
      <img src={assistant.poster} alt="" width={256} height={256} decoding="async" />
      {size === "large" ? <canvas ref={canvas} key={assistant.id} /> : null}
      <span className="ask-orb-dots"><i /><i /><i /></span>
    </span>
  );
}
