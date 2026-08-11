import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventDetailContent, EventDetailRequestError } from "../components/event-detail-content";
import { BookmarkProvider } from "../components/bookmark-provider";
import { LanguageProvider } from "../components/language-provider";
import type { KiwiCueEventDetail } from "../lib/events";

const detail: KiwiCueEventDetail = {
  id: "event-123",
  name: "Auckland Night Live",
  url: "https://www.ticketmaster.co.nz/event/event-123",
  imageUrl: "https://img.example/event.jpg",
  start: {
    localDate: "2026-08-08",
    localTime: "19:30:00",
    dateTime: "2026-08-08T07:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "onsale",
  category: "Music",
  venue: {
    id: "venue-civic",
    name: "The Civic",
    city: "Auckland",
    address: "269 Queen Street",
    postalCode: "1010",
    coordinates: { latitude: -36.8505, longitude: 174.7645 },
  },
  description: "Doors open at 6:30 pm.",
  note: "Age restrictions may apply.",
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderDetail(
  requestEventDetail: (eventId: string) => Promise<KiwiCueEventDetail>,
) {
  return render(
    <LanguageProvider>
      <BookmarkProvider>
        <EventDetailContent eventId="event-123" requestEventDetail={requestEventDetail} />
      </BookmarkProvider>
    </LanguageProvider>,
  );
}

describe("event detail experience", () => {
  it("shows verified information, booking guidance, address, map, distance action, and official link", async () => {
    const requestEventDetail = vi.fn().mockResolvedValue(detail);
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });

    renderDetail(requestEventDetail);

    expect(screen.getByRole("status")).toHaveTextContent("Loading event details");
    expect(await screen.findByRole("heading", { level: 1, name: "Auckland Night Live" })).toBeVisible();
    expect(requestEventDetail).toHaveBeenCalledWith("event-123");
    expect(screen.getByText("Sat, 8 Aug · 7:30 pm")).toBeVisible();
    expect(screen.queryByText(/price|fees|价格|费用|NZ\$/i)).not.toBeInTheDocument();
    expect(screen.getByText("Doors open at 6:30 pm.")).toBeVisible();
    expect(screen.getByText("Age restrictions may apply.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "How to book" })).toBeVisible();
    expect(screen.getByText("Choose Continue to official booking below.")).toBeVisible();
    const primaryBooking = screen.getByRole("link", { name: "Continue to official booking" });
    const description = screen.getByText("Doors open at 6:30 pm.");
    expect(primaryBooking.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("269 Queen Street")).toBeVisible();
    expect(screen.getByText("Auckland 1010")).toBeVisible();
    expect(screen.getByTitle("Map of The Civic")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show distance from me" })).toBeEnabled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save Auckland Night Live" }));
    expect(screen.getByRole("button", { name: "Remove Auckland Night Live from saved events" })).toHaveAttribute("aria-pressed", "true");
    expect(primaryBooking).toHaveAttribute("href", detail.url);
    expect(primaryBooking).toHaveAttribute("target", "_blank");
    expect(primaryBooking).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: "Open official event website" })).toHaveAttribute("href", detail.url);
    expect(screen.getByRole("link", { name: "Skip to event details" })).toHaveAttribute("href", "#event-detail");
  });

  it("uses truthful fallbacks when description and organiser notes are absent", async () => {
    renderDetail(vi.fn().mockResolvedValue({ ...detail, description: null, note: null }));

    await screen.findByRole("heading", { name: "Auckland Night Live" });
    expect(screen.getByText("No additional organiser description is available yet.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Organiser note" })).not.toBeInTheDocument();
  });

  it("keeps the address and booking usable when venue coordinates are missing", async () => {
    renderDetail(vi.fn().mockResolvedValue({
      ...detail,
      venue: { ...detail.venue!, coordinates: null },
    }));

    await screen.findByRole("heading", { name: "Auckland Night Live" });
    expect(screen.getByText("Map and distance are unavailable because this venue has no coordinates yet.")).toBeVisible();
    expect(screen.queryByTitle("Map of The Civic")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show distance from me" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to official booking" })).toBeVisible();
  });

  it("shows a dedicated not-found state", async () => {
    renderDetail(vi.fn().mockRejectedValue(new EventDetailRequestError(404)));

    expect(await screen.findByRole("heading", { name: "Event not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse Auckland events" })).toHaveAttribute("href", "/events");
  });

  it("retries a temporary detail failure", async () => {
    const requestEventDetail = vi.fn()
      .mockRejectedValueOnce(new EventDetailRequestError(503))
      .mockResolvedValueOnce(detail);
    renderDetail(requestEventDetail);

    expect(await screen.findByRole("heading", { name: "Event details are temporarily unavailable" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry event details" }));

    expect(await screen.findByRole("heading", { name: "Auckland Night Live" })).toBeVisible();
    expect(requestEventDetail).toHaveBeenCalledTimes(2);
  });

  it("switches the ready detail to Chinese without refetching", async () => {
    const requestEventDetail = vi.fn().mockResolvedValue(detail);
    renderDetail(requestEventDetail);
    await screen.findByRole("heading", { name: "Auckland Night Live" });

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "预约或购票方式" })).toBeVisible();
    expect(screen.getByRole("link", { name: "前往官网预约或购票" })).toBeVisible();
    expect(screen.getByRole("button", { name: "查看离我多远" })).toBeVisible();
    expect(screen.queryByText(/price|fees|价格|费用|NZ\$/i)).not.toBeInTheDocument();
    expect(requestEventDetail).toHaveBeenCalledTimes(1);
  });
});
