"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  BOOKMARK_STORAGE_KEY,
  parseBookmarks,
  serializeBookmarks,
  toggleBookmarkItem,
  type EventBookmark,
} from "../lib/bookmarks";
import { mergeSavedEventIds } from "../lib/social/guest-save-merge";
import type { KiwiCueEvent } from "../lib/events";
import { useAuth } from "./auth-provider";
import { trackActivity } from "../lib/social/activity";

const BOOKMARK_CHANGE_EVENT = "kiwicue-bookmarks-change";
const STORAGE_ERROR = "\0kiwicue-storage-error";

type BookmarkContextValue = {
  bookmarks: EventBookmark[];
  count: number;
  isHydrated: boolean;
  storageError: boolean;
  isBookmarked: (eventId: string) => boolean;
  toggleBookmark: (event: KiwiCueEvent) => void;
  clearBookmarks: () => void;
};

const emptyContext: BookmarkContextValue = {
  bookmarks: [],
  count: 0,
  isHydrated: false,
  storageError: false,
  isBookmarked: () => false,
  toggleBookmark: () => undefined,
  clearBookmarks: () => undefined,
};
const BookmarkContext = createContext<BookmarkContextValue>(emptyContext);

type CloudState = { userId: string; bookmarks: EventBookmark[]; error: boolean } | null;

function validatedCloudBookmarks(value: unknown): EventBookmark[] | null {
  if (typeof value !== "object" || value === null || !("bookmarks" in value)
    || !Array.isArray(value.bookmarks)) return null;
  return parseBookmarks(JSON.stringify({ version: 1, items: value.bookmarks }));
}

async function sendCloudMutation(method: "POST" | "DELETE", payload: unknown) {
  const response = await fetch("/api/me/saved", {
    method, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store",
  });
  if (!response.ok) throw new Error("Cloud saved events could not be updated");
  return response;
}

function mergeBookmarkSnapshots(cloud: EventBookmark[], local: EventBookmark[]): EventBookmark[] {
  const ids = mergeSavedEventIds(cloud.map(({ event }) => event.id), local.map(({ event }) => event.id));
  const byId = new Map([...local, ...cloud].map((item) => [item.event.id, item]));
  return ids.flatMap((id) => { const item = byId.get(id); return item ? [item] : []; });
}

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === BOOKMARK_STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(BOOKMARK_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(BOOKMARK_CHANGE_EVENT, onStoreChange);
  };
}

function getClientSnapshot(): string {
  try {
    return localStorage.getItem(BOOKMARK_STORAGE_KEY) ?? "";
  } catch {
    return STORAGE_ERROR;
  }
}

function getServerSnapshot(): string {
  return "";
}

function subscribeHydration() {
  return () => undefined;
}

function getHydratedSnapshot() {
  return true;
}

function getServerHydratedSnapshot() {
  return false;
}

function publishChange() {
  window.dispatchEvent(new Event(BOOKMARK_CHANGE_EVENT));
}

export function BookmarkProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const raw = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [writeError, setWriteError] = useState(false);
  const [cloud, setCloud] = useState<CloudState>(null);
  const localBookmarks = useMemo(
    () => raw === STORAGE_ERROR ? [] : parseBookmarks(raw || null),
    [raw],
  );
  const userId = auth.user?.id;

  useEffect(() => {
    if (!userId) return;
    const id = userId;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/me/saved", { cache: "no-store" });
        if (!response.ok) throw new Error("Cloud saved events unavailable");
        const existing = validatedCloudBookmarks(await response.json() as unknown);
        if (!existing) throw new Error("Invalid cloud saved events");
        const guest = parseBookmarks(localStorage.getItem(BOOKMARK_STORAGE_KEY));
        const known = new Set(existing.map(({ event }) => event.id));
        const missing = guest.filter(({ event }) => !known.has(event.id));
        if (missing.length > 0) {
          const response = await sendCloudMutation("POST", { events: missing.map(({ event }) => ({ event })) });
          const body: unknown = await response.json();
          const savedIds = body && typeof body === "object" && "saved" in body && Array.isArray(body.saved)
            ? body.saved.filter((id): id is string => typeof id === "string") : [];
          if (!missing.every(({ event }) => savedIds.includes(event.id))) {
            throw new Error("Cloud did not confirm every migrated save");
          }
        }
        const migrated = new Set(guest.map(({ event }) => event.id));
        const current = parseBookmarks(localStorage.getItem(BOOKMARK_STORAGE_KEY));
        const remaining = current.filter(({ event }) => !migrated.has(event.id));
        if (remaining.length) localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks(remaining));
        else localStorage.removeItem(BOOKMARK_STORAGE_KEY);
        publishChange();
        if (active) setCloud({ userId: id, bookmarks: mergeBookmarkSnapshots(existing, missing), error: false });
      } catch {
        if (active) setCloud({ userId: id, bookmarks: parseBookmarks(getClientSnapshot()), error: true });
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  const readyCloud = userId && cloud?.userId === userId ? cloud : null;
  const bookmarks = userId ? readyCloud?.bookmarks ?? localBookmarks : localBookmarks;
  const isReady = isHydrated && !auth.loading && (!userId || Boolean(readyCloud));

  const toggleBookmark = useCallback((event: KiwiCueEvent) => {
    if (userId) {
      if (!readyCloud) return;
      const before = readyCloud.bookmarks;
      const saved = before.some((item) => item.event.id === event.id);
      const next = toggleBookmarkItem(before, event);
      setCloud({ userId, bookmarks: next, error: false });
      setWriteError(false);
      void sendCloudMutation(saved ? "DELETE" : "POST", saved
        ? { eventId: event.id } : { event }).then(() => {
          void trackActivity({ action: saved ? "event_unsave" : "event_save", eventId: event.id });
        }).catch(() => {
          setCloud({ userId, bookmarks: before, error: true });
          setWriteError(true);
        });
      return;
    }
    try {
      const current = parseBookmarks(localStorage.getItem(BOOKMARK_STORAGE_KEY));
      localStorage.setItem(
        BOOKMARK_STORAGE_KEY,
        serializeBookmarks(toggleBookmarkItem(current, event)),
      );
      setWriteError(false);
      publishChange();
    } catch {
      setWriteError(true);
    }
  }, [readyCloud, userId]);

  const clearBookmarks = useCallback(() => {
    if (userId) {
      if (!readyCloud) return;
      const before = readyCloud.bookmarks;
      setCloud({ userId, bookmarks: [], error: false });
      void sendCloudMutation("DELETE", { all: true }).catch(() => {
        setCloud({ userId, bookmarks: before, error: true });
        setWriteError(true);
      });
      return;
    }
    try {
      localStorage.removeItem(BOOKMARK_STORAGE_KEY);
      setWriteError(false);
      publishChange();
    } catch {
      setWriteError(true);
    }
  }, [readyCloud, userId]);

  const value = useMemo<BookmarkContextValue>(() => ({
    bookmarks,
    count: bookmarks.length,
    isHydrated: isReady,
    storageError: raw === STORAGE_ERROR || writeError || Boolean(readyCloud?.error),
    isBookmarked: (eventId: string) => bookmarks.some((bookmark) => bookmark.event.id === eventId),
    toggleBookmark,
    clearBookmarks,
  }), [bookmarks, clearBookmarks, isReady, raw, readyCloud?.error, toggleBookmark, writeError]);

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarks(): BookmarkContextValue {
  return useContext(BookmarkContext);
}
