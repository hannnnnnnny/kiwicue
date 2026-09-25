"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Critically-tuned spring (ζ≈0.74, ~3% overshoot) sampled into CSS linear() for WAAPI. */
const SPRING =
  "linear(0, 0.042 3.6%, 0.144 7.1%, 0.275 10.7%, 0.414 14.3%, 0.547 17.9%, 0.666 21.4%, 0.767 25%, 0.849 28.6%, 0.912 32.1%, 0.958 35.7%, 0.991 39.3%, 1.012 42.9%, 1.024 46.4%, 1.03 50%, 1.032 53.6%, 1.03 57.1%, 1.026 60.7%, 1.022 64.3%, 1.018 67.9%, 1.014 71.4%, 1.01 75%, 1.007 78.6%, 1.004 82.1%, 1.003 85.7%, 1.001 89.3%, 1)";
const SPRING_FALLBACK = "cubic-bezier(0.22, 1.1, 0.36, 1)";
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";

export const MOTION_MS = { layout: 300, width: 280, enter: 260, exit: 180 } as const;

type Box = { left: number; top: number; width: number; labelOffset: number | null };
type Snapshot = { items: Map<string, Box>; heights: Map<string, number> };
type RefCallback = (node: HTMLElement | null) => void;

let springEasing: string | null = null;
function spring(): string {
  springEasing ??= typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)")
    ? SPRING
    : SPRING_FALLBACK;
  return springEasing;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAnimate(node: Element): boolean {
  return typeof node.animate === "function" && !prefersReducedMotion();
}

// Rects are read while earlier animations are still running, so an interrupted
// chip starts its next move from where it visibly is instead of snapping back.
function measure(node: HTMLElement): Box {
  const rect = node.getBoundingClientRect();
  const surface = node.querySelector<HTMLElement>("[data-motion-surface]");
  const label = node.querySelector<HTMLElement>("[data-motion-label]");
  return {
    left: rect.left,
    top: rect.top,
    width: surface ? surface.getBoundingClientRect().width : rect.width,
    labelOffset: label ? label.getBoundingClientRect().left - rect.left : null,
  };
}

function cancelAnimations(node: HTMLElement) {
  node.getAnimations?.({ subtree: true }).forEach((animation) => animation.cancel());
}

function animateMove(node: HTMLElement, from: Box) {
  const to = measure(node);
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    node.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration: MOTION_MS.layout, easing: spring() },
    );
  }
  // The pill surface is absolutely positioned, so interpolating its `right` edge grows the
  // chip from its left anchor without scale-distorting the rounded ends or the text.
  const surface = node.querySelector<HTMLElement>("[data-motion-surface]");
  const growth = to.width - from.width;
  if (surface && Math.abs(growth) > 0.5) {
    surface.animate([{ right: `${growth}px` }, { right: "0px" }], { duration: MOTION_MS.width, easing: spring() });
  }
  const label = node.querySelector<HTMLElement>("[data-motion-label]");
  if (label && from.labelOffset !== null && to.labelOffset !== null) {
    const shift = from.labelOffset - to.labelOffset;
    if (Math.abs(shift) > 0.5) {
      label.animate([{ transform: `translateX(${shift}px)` }, { transform: "none" }], {
        duration: MOTION_MS.width,
        easing: spring(),
      });
    }
  }
}

function animateEnter(node: HTMLElement) {
  node.animate(
    [{ opacity: 0, transform: "scale(0.8)" }, { opacity: 1, transform: "none" }],
    { duration: MOTION_MS.enter, easing: spring(), fill: "backwards" },
  );
}

function animateHeight(node: HTMLElement, from: number | undefined) {
  const to = node.getBoundingClientRect().height;
  if (from === undefined || Math.abs(from - to) < 1) return;
  node.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: MOTION_MS.layout, easing: spring() });
}

function play(snapshot: Snapshot, items: Map<string, HTMLElement>, containers: Map<string, HTMLElement>) {
  // Leaving chips own their exit animation; cancelling it would strand them on screen.
  const settled = [...items].filter(([, node]) => !node.hasAttribute("data-leaving"));
  settled.forEach(([, node]) => cancelAnimations(node));
  containers.forEach((node) => node.getAnimations?.().forEach((animation) => animation.cancel()));
  if (prefersReducedMotion()) return;
  containers.forEach((node, key) => { if (canAnimate(node)) animateHeight(node, snapshot.heights.get(key)); });
  settled.forEach(([key, node]) => {
    if (!canAnimate(node)) return;
    const from = snapshot.items.get(key);
    if (from) animateMove(node, from);
    else animateEnter(node);
  });
}

function cachedRef(cache: Map<string, RefCallback>, id: string, target: Map<string, HTMLElement>, key: string) {
  let callback = cache.get(id);
  if (!callback) {
    callback = (node) => { if (node) target.set(key, node); else target.delete(key); };
    cache.set(id, callback);
  }
  return callback;
}

/**
 * FLIP layout animation: `capture()` records every registered element before a state
 * change; after React commits, each element is animated from its old box to its new one.
 */
export function useLayoutMotion() {
  const items = useRef(new Map<string, HTMLElement>());
  const containers = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, RefCallback>());
  const snapshot = useRef<Snapshot | null>(null);

  const item = useCallback((key: string) => cachedRef(refs.current, `item:${key}`, items.current, key), []);
  const container = useCallback(
    (key: string) => cachedRef(refs.current, `box:${key}`, containers.current, key),
    [],
  );

  const capture = useCallback(() => {
    const itemBoxes = new Map([...items.current].map(([key, node]) => [key, measure(node)] as const));
    const heights = new Map([...containers.current].map(([key, node]) => [key, node.getBoundingClientRect().height] as const));
    snapshot.current = { items: itemBoxes, heights };
    // A capture whose state change never commits must not animate some later render.
    requestAnimationFrame(() => { snapshot.current = null; });
  }, []);

  const nudge = useCallback((key: string) => {
    const node = items.current.get(key);
    if (!node || !canAnimate(node)) return;
    node.animate(
      [0, -5, 4, -2, 1, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 360, easing: "ease-out" },
    );
  }, []);

  useLayoutEffect(() => {
    if (!snapshot.current) return;
    play(snapshot.current, items.current, containers.current);
    snapshot.current = null;
  });

  return { item, container, capture, nudge };
}

/** Fade + scale a chip out, then report back so the list can drop it and slide the rest. */
export function animateExit(node: HTMLElement, onDone: () => void): () => void {
  if (!canAnimate(node)) {
    onDone();
    return () => undefined;
  }
  const animation = node.animate(
    [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.8)" }],
    { duration: MOTION_MS.exit, easing: EXIT_EASE, fill: "forwards" },
  );
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(fallback);
    onDone();
  };
  // Hidden tabs stop producing frames, so onfinish can stall indefinitely; timers keep running.
  const fallback = window.setTimeout(finish, MOTION_MS.exit + 120);
  animation.onfinish = finish;
  // Cancelled means the chip was re-added mid-exit, so there is nothing to release.
  return () => {
    settled = true;
    window.clearTimeout(fallback);
    animation.cancel();
  };
}

export type PresenceEntry<T> = { key: string; item: T; leaving: boolean };

function mergePresence<T extends { key: string }>(previous: PresenceEntry<T>[], items: readonly T[]) {
  const current = new Set(items.map((item) => item.key));
  const merged: PresenceEntry<T>[] = [];
  let cursor = 0;
  for (const entry of previous) {
    if (!current.has(entry.key)) {
      merged.push({ ...entry, leaving: true });
      continue;
    }
    // Flush new items up to this surviving one so removed chips keep their slot while leaving.
    while (cursor < items.length) {
      const item = items[cursor++];
      merged.push({ key: item.key, item, leaving: false });
      if (item.key === entry.key) break;
    }
  }
  for (; cursor < items.length; cursor++) merged.push({ key: items[cursor].key, item: items[cursor], leaving: false });
  return merged;
}

/** Keeps removed items rendered (flagged `leaving`) until their exit animation releases them. */
export function usePresence<T extends { key: string }>(items: readonly T[]) {
  const [state, setState] = useState(() => ({
    source: items,
    entries: items.map((item) => ({ key: item.key, item, leaving: false })),
  }));
  let entries = state.entries;
  if (state.source !== items) {
    entries = mergePresence(state.entries, items);
    setState({ source: items, entries });
  }
  const release = useCallback((key: string) => {
    setState((prev) => ({ ...prev, entries: prev.entries.filter((entry) => !(entry.leaving && entry.key === key)) }));
  }, []);
  return { entries, release };
}
