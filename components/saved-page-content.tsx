"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EventCard } from "../app/events/event-card";
import type { KiwiCueEvent, KiwiCueEventDetail } from "../lib/events";
import { useBookmarks } from "./bookmark-provider";
import { requestEventDetailFromApi } from "./event-detail-content";
import { EventGridSkeleton } from "./event-grid-skeleton";
import { useLanguage } from "./language-provider";
import { PortalHeader } from "./portal-header";

type RefreshState = {
  key: string;
  events: KiwiCueEvent[];
  failures: number;
};

const copy = {
  en: {
    eyebrow: "Your Auckland shortlist",
    title: "Saved events",
    intro: "Keep the useful ones together on this device—no account needed.",
    count: (count: number) => `${count} saved ${count === 1 ? "event" : "events"}`,
    clear: "Clear all saved events",
    confirmClear: "Confirm clearing all saved events",
    refreshing: (count: number) => `Refreshing ${count} saved ${count === 1 ? "event" : "events"}`,
    partial: (count: number) => `${count} saved ${count === 1 ? "event" : "events"} could not be refreshed. The saved copy is still shown.`,
    storageError: "This browser is blocking saved-event storage. You can still browse and open event details.",
    emptyCode: "SAVED / 00",
    emptyTitle: "No saved events yet",
    emptyBody: "Use the Save button on any event to keep it here for later.",
    browse: "Browse Auckland events",
    loading: "Loading saved events",
    privacy: "Saved events stay in this browser. KiwiCue does not receive your shortlist.",
    footer: "A shorter list for quicker decisions.",
  },
  zh: {
    eyebrow: "你的奥克兰活动清单",
    title: "我收藏的活动",
    intro: "把真正想去的活动留在这台设备，无需注册账号。",
    count: (count: number) => `已收藏 ${count} 个活动`,
    clear: "清空全部收藏",
    confirmClear: "确认清空全部收藏",
    refreshing: (count: number) => `正在刷新 ${count} 个收藏活动`,
    partial: (count: number) => `${count} 个收藏活动暂时无法刷新，仍为你显示已保存的信息。`,
    storageError: "当前浏览器阻止保存收藏。你仍然可以浏览并打开活动详情。",
    emptyCode: "收藏 / 00",
    emptyTitle: "还没有收藏活动",
    emptyBody: "在任意活动上点击“收藏”，就能稍后在这里快速找到。",
    browse: "浏览奥克兰活动",
    loading: "正在加载收藏活动",
    privacy: "收藏只保存在这个浏览器里，KiwiCue 不会收到你的清单。",
    footer: "清单更短，决定更快。",
  },
} as const;

export function SavedPageContent({
  requestEventDetail = requestEventDetailFromApi,
}: {
  requestEventDetail?: (eventId: string) => Promise<KiwiCueEventDetail>;
}) {
  const { language } = useLanguage();
  const {
    bookmarks,
    clearBookmarks,
    isHydrated,
    storageError,
  } = useBookmarks();
  const content = copy[language];
  const requestKey = bookmarks.map((bookmark) => `${bookmark.event.id}:${bookmark.savedAt}`).join("|");
  const [clearConfirmationKey, setClearConfirmationKey] = useState<string | null>(null);
  const clearArmed = clearConfirmationKey === requestKey;
  const [refresh, setRefresh] = useState<RefreshState | null>(null);
  const currentRefresh = refresh?.key === requestKey ? refresh : null;

  useEffect(() => {
    if (!isHydrated || bookmarks.length === 0) return;
    let active = true;
    Promise.all(bookmarks.map(async (bookmark) => {
      try {
        return { event: await requestEventDetail(bookmark.event.id), failed: false };
      } catch {
        return { event: bookmark.event, failed: true };
      }
    })).then((results) => {
      if (!active) return;
      setRefresh({
        key: requestKey,
        events: results.map((result) => result.event),
        failures: results.filter((result) => result.failed).length,
      });
    });
    return () => { active = false; };
  }, [bookmarks, isHydrated, requestEventDetail, requestKey]);

  const visibleEvents = currentRefresh?.events ?? bookmarks.map((bookmark) => bookmark.event);

  return (
    <main className="saved-page">
      <PortalHeader skipTarget="saved-events" currentPage="saved" />
      <section className="saved-masthead">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
      </section>

      {!isHydrated ? (
        <section id="saved-events" className="event-state event-loading" role="status" aria-busy="true">
          <p>{content.loading}</p>
          <EventGridSkeleton count={4} />
        </section>
      ) : bookmarks.length === 0 ? (
        <section id="saved-events" className="event-state saved-empty" aria-live="polite">
          <span className="state-code" aria-hidden="true">{content.emptyCode}</span>
          <h2>{content.emptyTitle}</h2>
          <p>{content.emptyBody}</p>
          {storageError && <p className="saved-storage-error" role="alert">{content.storageError}</p>}
          <Link className="portal-empty-action" href="/events">{content.browse}</Link>
        </section>
      ) : (
        <section id="saved-events" className="saved-feed">
          <div className="saved-toolbar">
            <p>{content.count(bookmarks.length)}</p>
            <button
              type="button"
              className={clearArmed ? "is-armed" : undefined}
              onClick={() => {
                if (clearArmed) clearBookmarks();
                else setClearConfirmationKey(requestKey);
              }}
            >
              {clearArmed ? content.confirmClear : content.clear}
            </button>
          </div>
          {storageError && <p className="saved-storage-error" role="alert">{content.storageError}</p>}
          {!currentRefresh && <p className="saved-refresh-status" role="status">{content.refreshing(bookmarks.length)}</p>}
          {currentRefresh && currentRefresh.failures > 0 && (
            <p className="saved-refresh-warning" role="alert">{content.partial(currentRefresh.failures)}</p>
          )}
          <ol className="event-grid saved-event-grid">
            {visibleEvents.map((event, index) => (
              <li key={event.id}><EventCard event={event} index={index} language={language} /></li>
            ))}
          </ol>
          <p className="saved-privacy">{content.privacy}</p>
        </section>
      )}

      <footer className="portal-footer">
        <span>KiwiCue / 纽村小报</span>
        <span>{content.footer}</span>
      </footer>
    </main>
  );
}
