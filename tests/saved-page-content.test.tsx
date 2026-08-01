import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import { SavedPageContent } from "../components/saved-page-content";
import { BOOKMARK_STORAGE_KEY, serializeBookmarks, toBookmark } from "../lib/bookmarks";
import type { KiwiCueEvent, KiwiCueEventDetail } from "../lib/events";

function event(id: string, name = `Saved ${id}`): KiwiCueEvent {
  return {
    id,
    name,
    url: `https://www.ticketmaster.co.nz/event/${id}`,
    imageUrl: null,
    start: {
      localDate: "2026-08-08",
      localTime: "19:30:00",
      dateTime: "2026-08-08T07:30:00Z",
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category: "Music",
    venue: null,
  };
}

function detail(savedEvent: KiwiCueEvent, name = savedEvent.name): KiwiCueEventDetail {
  return { ...savedEvent, name, description: null, note: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function persist(...events: KiwiCueEvent[]) {
  localStorage.setItem(
    BOOKMARK_STORAGE_KEY,
    serializeBookmarks(events.map((savedEvent, index) =>
      toBookmark(savedEvent, new Date(Date.UTC(2026, 7, 1, index)).toISOString()))),
  );
}

function renderSaved(requestEventDetail = vi.fn(async (id: string) => detail(event(id)))) {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <SavedPageContent requestEventDetail={requestEventDetail} />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Saved events page", () => {
  it("shows a useful empty state without making a network request", async () => {
    const requestEventDetail = vi.fn();
    renderSaved(requestEventDetail);

    expect(await screen.findByRole("heading", { name: "No saved events yet" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse Auckland events" })).toHaveAttribute("href", "/events");
    expect(requestEventDetail).not.toHaveBeenCalled();
  });

  it("explains blocked storage even when the saved list is empty", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    renderSaved();

    expect(await screen.findByRole("heading", { name: "No saved events yet" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("browser is blocking saved-event storage");
    expect(screen.getByRole("link", { name: "Browse Auckland events" })).toBeVisible();
  });

  it("shows saved copies immediately while refreshing official details", () => {
    const pending = deferred<KiwiCueEventDetail>();
    const requestEventDetail = vi.fn(() => pending.promise);
    persist(event("event-1", "Local Harbour Lights"));

    renderSaved(requestEventDetail);

    expect(screen.getByRole("heading", { name: "Local Harbour Lights" })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing 1 saved event");
    expect(screen.getByRole("link", { name: "Saved events, 1" })).toHaveAttribute("href", "/saved");
  });

  it("replaces saved copies with refreshed official details", async () => {
    const saved = event("event-1", "Old title");
    persist(saved);
    renderSaved(vi.fn().mockResolvedValue(detail(saved, "Official current title")));

    expect(await screen.findByRole("heading", { name: "Official current title" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Old title" })).not.toBeInTheDocument();
    expect(screen.getByText("1 saved event")).toBeVisible();
  });

  it("keeps a saved copy when one official refresh fails", async () => {
    const first = event("event-1", "First saved copy");
    const second = event("event-2", "Second saved copy");
    persist(first, second);
    const requestEventDetail = vi.fn((id: string) => id === "event-1"
      ? Promise.resolve(detail(first, "First refreshed"))
      : Promise.reject(new Error("not found")));

    renderSaved(requestEventDetail);

    expect(await screen.findByRole("heading", { name: "First refreshed" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Second saved copy" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("1 saved event could not be refreshed");
  });

  it("removes one event and can clear the rest", async () => {
    const first = event("event-1", "First saved");
    const second = event("event-2", "Second saved");
    persist(first, second);
    renderSaved(vi.fn((id: string) => Promise.resolve(detail(id === "event-1" ? first : second))));
    await screen.findByRole("heading", { name: "First saved" });

    fireEvent.click(screen.getByRole("button", { name: "Remove First saved from saved events" }));
    expect(screen.queryByRole("heading", { name: "First saved" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved events, 1" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear all saved events" }));
    expect(screen.getByRole("heading", { name: "Second saved" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm clearing all saved events" }));
    expect(await screen.findByRole("heading", { name: "No saved events yet" })).toBeVisible();
  });

  it("cancels an armed clear-all action when the saved list changes", async () => {
    const first = event("event-1", "First saved");
    const second = event("event-2", "Second saved");
    persist(first, second);
    renderSaved(vi.fn((id: string) => Promise.resolve(detail(id === "event-1" ? first : second))));
    await screen.findByRole("heading", { name: "First saved" });

    fireEvent.click(screen.getByRole("button", { name: "Clear all saved events" }));
    expect(screen.getByRole("button", { name: "Confirm clearing all saved events" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Remove First saved from saved events" }));

    expect(await screen.findByRole("button", { name: "Clear all saved events" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Second saved" })).toBeVisible();
  });

  it("switches the page and bookmark actions to Chinese", async () => {
    const saved = event("event-1", "Harbour Lights");
    persist(saved);
    renderSaved(vi.fn().mockResolvedValue(detail(saved)));
    await screen.findByRole("heading", { name: "Harbour Lights" });

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "我收藏的活动" })).toBeVisible();
    expect(screen.getByRole("button", { name: "从收藏中移除 Harbour Lights" })).toBeVisible();
    expect(screen.getByRole("button", { name: "清空全部收藏" })).toBeVisible();
  });
});
