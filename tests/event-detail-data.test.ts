import { describe, expect, it, vi } from "vitest";
import { EventPageDataError, resolveEventPageData } from "../lib/event-detail-data";
import type { KiwiCueEventDetail } from "../lib/events";
import { TicketmasterClientError } from "../lib/ticketmaster";

const detail = { id: "event-123" } as KiwiCueEventDetail;

describe("event page data", () => {
  it("rejects unsafe ids before provider access", async () => {
    const loadTicketmaster = vi.fn();
    const findCurated = vi.fn();
    await expect(resolveEventPageData("../secret", { loadTicketmaster, findCurated }))
      .rejects.toEqual(new EventPageDataError("INVALID_EVENT_ID", 404));
    expect(loadTicketmaster).not.toHaveBeenCalled();
  });

  it("resolves regular events and maps provider not-found safely", async () => {
    const findCurated = vi.fn();
    await expect(resolveEventPageData("event-123", { loadTicketmaster: vi.fn().mockResolvedValue(detail), findCurated }))
      .resolves.toBe(detail);
    await expect(resolveEventPageData("event-404", {
      loadTicketmaster: vi.fn().mockRejectedValue(new TicketmasterClientError("UPSTREAM_NOT_FOUND", 404)),
      findCurated,
    })).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
