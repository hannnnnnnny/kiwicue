"use client";

import { useSyncExternalStore } from "react";
import type { DiscoveryCollection } from "../lib/discovery-collections";

const navigationEvent = "kiwicue:collection-change";
const listeners = new Set<() => void>();
const browserEvents = ["hashchange", "popstate", navigationEvent];
function notify() { listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) {
  if (!listeners.size) browserEvents.forEach(event => window.addEventListener(event, notify));
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) browserEvents.forEach(event => window.removeEventListener(event, notify));
  };
}
function getCollection(): DiscoveryCollection {
  const hash = window.location.hash.slice(1);
  if (hash === "map") return "nearby";
  return hash === "tonight" || hash === "weekend" || hash === "free" || hash === "music" ? hash : "all";
}
export function navigateDiscovery(collection: DiscoveryCollection) {
  const hash = collection === "all" ? "" : `#${collection === "nearby" ? "map" : collection}`;
  if (window.location.hash !== hash) {
    // Preserve Next's history state so browser Back remains compatible with the router.
    window.history.pushState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
  }
  window.dispatchEvent(new Event(navigationEvent));
}
export function useDiscoveryCollection() {
  return useSyncExternalStore(subscribe, getCollection, () => "all" as const);
}
