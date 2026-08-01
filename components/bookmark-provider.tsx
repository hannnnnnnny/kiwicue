"use client";

import {
  createContext,
  useCallback,
  useContext,
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
import type { KiwiCueEvent } from "../lib/events";

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
  const raw = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const [writeError, setWriteError] = useState(false);
  const bookmarks = useMemo(
    () => raw === STORAGE_ERROR ? [] : parseBookmarks(raw || null),
    [raw],
  );

  const toggleBookmark = useCallback((event: KiwiCueEvent) => {
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
  }, []);

  const clearBookmarks = useCallback(() => {
    try {
      localStorage.removeItem(BOOKMARK_STORAGE_KEY);
      setWriteError(false);
      publishChange();
    } catch {
      setWriteError(true);
    }
  }, []);

  const value = useMemo<BookmarkContextValue>(() => ({
    bookmarks,
    count: bookmarks.length,
    isHydrated,
    storageError: raw === STORAGE_ERROR || writeError,
    isBookmarked: (eventId: string) => bookmarks.some((bookmark) => bookmark.event.id === eventId),
    toggleBookmark,
    clearBookmarks,
  }), [bookmarks, clearBookmarks, isHydrated, raw, toggleBookmark, writeError]);

  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

export function useBookmarks(): BookmarkContextValue {
  return useContext(BookmarkContext);
}
