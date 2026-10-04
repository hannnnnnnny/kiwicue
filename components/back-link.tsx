"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

const IN_APP_KEY = "kiwicue:in-app";

function remember(value: boolean) {
  try {
    if (value) sessionStorage.setItem(IN_APP_KEY, "1");
    else sessionStorage.removeItem(IN_APP_KEY);
  } catch (error) {
    if (!(error instanceof DOMException)) throw error; // Blocked storage: back links fall back to their list.
  }
}

/** True when the previous entry in this tab is a KiwiCue page, so `history.back()` stays on the site. */
export function cameFromKiwiCue(): boolean {
  try {
    return window.history.length > 1 && sessionStorage.getItem(IN_APP_KEY) === "1";
  } catch {
    return false; // Blocked storage: assume the visitor arrived from elsewhere.
  }
}

/**
 * Notes whether the visitor has moved between KiwiCue pages in this tab. A page opened from
 * another site (a search result, a shared link) starts fresh even if this tab visited before.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const first = useRef<string | null>(null);
  useEffect(() => {
    if (first.current === null) {
      first.current = pathname;
      const referrer = document.referrer ? new URL(document.referrer).origin : null;
      if (referrer !== window.location.origin) remember(false);
      return;
    }
    if (pathname !== first.current) remember(true);
  }, [pathname]);
  return null;
}

/**
 * "← Back" that really goes back, keeping the list's filters and scroll, when the visitor came
 * from a KiwiCue page; otherwise it opens `fallback`.
 */
export function BackLink({ fallback, className, label, children }: { fallback: string; className?: string; label?: string; children: ReactNode }) {
  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!cameFromKiwiCue()) return;
    event.preventDefault();
    // The router follows popstate, so a plain history step keeps Next's cached page and scroll.
    window.history.back();
  }
  return <Link className={className} href={fallback} aria-label={label} onClick={goBack}>{children}</Link>;
}
