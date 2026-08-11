import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventCard } from "../app/events/event-card";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import { BOOKMARK_STORAGE_KEY, parseBookmarks } from "../lib/bookmarks";
import type { KiwiCueEvent } from "../lib/events";

const event: KiwiCueEvent = {
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
  venue: null,
};

function renderCard() {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <EventCard event={event} index={0} language={localStorage.getItem("kiwicue-language") === "zh" ? "zh" : "en"} />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("event bookmark button", () => {
  it("is separate from navigation and toggles a visible pressed state", () => {
    renderCard();
    const button = screen.getByRole("button", { name: "Save Harbour Lights" });

    expect(button.closest("a")).toBeNull();
    expect(button).toHaveTextContent("Save");
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);

    expect(screen.getByRole("button", { name: "Remove Harbour Lights from saved events" })).toHaveTextContent("Saved");
    expect(screen.getByRole("button", { name: "Remove Harbour Lights from saved events" })).toHaveAttribute("aria-pressed", "true");
    expect(parseBookmarks(localStorage.getItem(BOOKMARK_STORAGE_KEY))).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View Harbour Lights details" })).toHaveAttribute("href", "/events/event-1");
  });

  it("uses clear Chinese save labels", () => {
    localStorage.setItem("kiwicue-language", "zh");
    renderCard();

    expect(screen.getByRole("button", { name: "收藏 Harbour Lights" })).toHaveTextContent("收藏");
  });

  it("explains a blocked storage write and keeps event navigation usable", () => {
    renderCard();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Harbour Lights" }));

    expect(screen.getByRole("button", { name: "Try saving Harbour Lights again" })).toHaveTextContent("Try again");
    expect(screen.getByRole("link", { name: "View Harbour Lights details" })).toHaveAttribute("href", "/events/event-1");
  });
});
