import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider, useBookmarks } from "../components/bookmark-provider";
import { BOOKMARK_STORAGE_KEY, serializeBookmarks, toBookmark } from "../lib/bookmarks";
import type { KiwiCueEvent } from "../lib/events";

const savedEvent: KiwiCueEvent = {
  id: "event-1",
  name: "Harbour Lights",
  url: "https://www.ticketmaster.co.nz/event/event-1",
  imageUrl: null,
  start: {
    localDate: "2026-08-08",
    localTime: "19:30:00",
    dateTime: "2026-08-08T07:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "onsale",
  category: "Music",
  priceRange: null,
  venue: null,
};

function Probe() {
  const bookmarks = useBookmarks();
  return (
    <>
      <output aria-label="bookmark count">{bookmarks.count}</output>
      <output aria-label="hydrated">{String(bookmarks.isHydrated)}</output>
      <output aria-label="storage error">{String(bookmarks.storageError)}</output>
      <button type="button" onClick={() => bookmarks.toggleBookmark(savedEvent)}>Toggle</button>
      <button type="button" onClick={bookmarks.clearBookmarks}>Clear</button>
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("BookmarkProvider", () => {
  it("uses an empty hydration-safe server snapshot", () => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(savedEvent)]));

    const html = renderToString(<BookmarkProvider><Probe /></BookmarkProvider>);

    expect(html).toContain("bookmark count");
    expect(html).toContain(">0</output>");
    expect(html).toContain(">false</output>");
  });

  it("loads persisted bookmarks and writes only after an explicit toggle", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(savedEvent)]));
    setItem.mockClear();

    render(<BookmarkProvider><Probe /></BookmarkProvider>);

    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("1");
    expect(screen.getByLabelText("hydrated")).toHaveTextContent("true");
    expect(setItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("0");
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("synchronises native cross-tab storage changes", () => {
    render(<BookmarkProvider><Probe /></BookmarkProvider>);
    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("0");

    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(savedEvent)]));
    fireEvent(window, new StorageEvent("storage", { key: BOOKMARK_STORAGE_KEY }));

    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("1");
  });

  it("keeps children usable and reports storage failures", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    render(<BookmarkProvider><Probe /></BookmarkProvider>);

    expect(screen.getByRole("button", { name: "Toggle" })).toBeEnabled();
    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("0");
    expect(screen.getByLabelText("storage error")).toHaveTextContent("true");
  });

  it("clears bookmarks and publishes the change in the same tab", () => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(savedEvent)]));
    render(<BookmarkProvider><Probe /></BookmarkProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByLabelText("bookmark count")).toHaveTextContent("0");
    expect(localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBeNull();
  });
});
