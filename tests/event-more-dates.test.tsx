import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventDetailContent } from "../components/event-detail-content";
import { LanguageProvider } from "../components/language-provider";
import type { KiwiCueEvent, KiwiCueEventDetail } from "../lib/events";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));

const base: KiwiCueEvent = {
  id: "cabaret-1", name: "Cabaret", url: "https://www.ticketmaster.co.nz/event/cabaret-1", imageUrl: null,
  start: { localDate: "2026-10-21", localTime: "19:00:00", dateTime: "2026-10-21T06:00:00Z", timezone: "Pacific/Auckland" },
  status: "onsale", category: "Arts & Theatre", venue: null,
};

describe("event page dates", () => {
  afterEach(cleanup);

  it("links the show's other dates", () => {
    const later = { ...base, id: "cabaret-2", start: { ...base.start, localDate: "2026-10-22", dateTime: "2026-10-22T06:00:00Z" } };
    render(<LanguageProvider><EventDetailContent initialEvent={base as KiwiCueEventDetail} otherSessions={[later]} /></LanguageProvider>);
    expect(screen.getByRole("heading", { name: "More dates" })).toBeVisible();
    expect(screen.getByRole("link", { name: /22 Oct/u })).toHaveAttribute("href", "/events/cabaret-2");
  });
});
