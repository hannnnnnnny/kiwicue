"use client";

import type { KiwiCueEvent } from "../lib/events";
import { useBookmarks } from "./bookmark-provider";
import type { Language } from "./language-provider";

const copy = {
  en: {
    save: "Save",
    saved: "Saved",
    retry: "Try again",
    saveLabel: (name: string) => `Save ${name}`,
    removeLabel: (name: string) => `Remove ${name} from saved events`,
    retrySaveLabel: (name: string) => `Try saving ${name} again`,
    retryRemoveLabel: (name: string) => `Try removing ${name} again`,
  },
  zh: {
    save: "收藏",
    saved: "已收藏",
    retry: "重试",
    saveLabel: (name: string) => `收藏 ${name}`,
    removeLabel: (name: string) => `从收藏中移除 ${name}`,
    retrySaveLabel: (name: string) => `重新尝试收藏 ${name}`,
    retryRemoveLabel: (name: string) => `重新尝试移除 ${name}`,
  },
} as const;

export function BookmarkButton({ event, language, placement = "card" }: {
  event: KiwiCueEvent;
  language: Language;
  placement?: "card" | "detail";
}) {
  const { isBookmarked, storageError, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(event.id);
  const content = copy[language];

  return (
    <button
      className={`bookmark-button bookmark-button-${placement}`}
      type="button"
      aria-pressed={saved}
      aria-label={storageError
        ? saved ? content.retryRemoveLabel(event.name) : content.retrySaveLabel(event.name)
        : saved ? content.removeLabel(event.name) : content.saveLabel(event.name)}
      onClick={() => toggleBookmark(event)}
    >
      <span aria-hidden="true">{storageError ? "!" : saved ? "♥" : "♡"}</span>
      <span>{storageError ? content.retry : saved ? content.saved : content.save}</span>
    </button>
  );
}
