import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CuratedMarketDiscovery } from "../components/curated-market-discovery";
import { LanguageProvider } from "../components/language-provider";
import type { AucklandEventsResult, KiwiCueEvent } from "../lib/events";

function event(id: string): KiwiCueEvent {
  return {
    id,
    name: `Market ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: { localDate: "2099-09-01", localTime: "09:00:00", dateTime: "2099-09-01T00:00:00Z", timezone: "Pacific/Auckland" },
    status: "schedule_verified",
    category: "Market",
    venue: null,
    source: { name: "Market organiser", url: "https://example.com/organiser", verifiedAt: "2099-08-01", provenance: "recurring-schedule" },
  };
}

function result(events: KiwiCueEvent[], totalElements = events.length): AucklandEventsResult {
  return { events, page: { size: 50, totalElements, totalPages: 1, number: 0 }, nextCursor: null };
}

function renderDiscovery(requestMarkets: (options: Record<string, string>) => Promise<AucklandEventsResult>, category: "concerts" | null = null) {
  return render(
    <LanguageProvider>
      <CuratedMarketDiscovery category={category} requestMarkets={requestMarkets} />
    </LanguageProvider>,
  );
}

afterEach(() => cleanup());

describe("independent market discovery", () => {
  it("does not request or render a duplicate source for a selected category", () => {
    const requestMarkets = vi.fn().mockResolvedValue(result([event("one")]));
    renderDiscovery(requestMarkets, "concerts");
    expect(requestMarkets).not.toHaveBeenCalled();
    expect(screen.queryByText("Neighbourhood markets, alongside the main feed")).not.toBeInTheDocument();
  });

  it("deduplicates schedules, previews three and keeps the rest expandable", async () => {
    const requestMarkets = vi.fn().mockResolvedValue(result([
      event("one"), event("two"), event("three"), event("three"), event("four"),
    ], 5));
    renderDiscovery(requestMarkets);

    expect((await screen.findByText("Neighbourhood markets, alongside the main feed")).textContent).toBe("Neighbourhood markets, alongside the main feed");
    expect(screen.getByText("3 of 5 organiser schedules")).toBeInTheDocument();
    const previewList = document.querySelector(".curated-market-discovery > ol");
    expect(previewList).not.toBeNull();
    expect(within(previewList as HTMLElement).getAllByRole("heading", { name: /^Market / })).toHaveLength(3);
    expect(screen.getByText("Show 1 more market")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Show 1 more market"));
    expect(screen.getAllByRole("heading", { name: /^Market / })).toHaveLength(4);
    expect(requestMarkets).toHaveBeenCalledWith({});
  });

  it("keeps an independent error retryable without exposing upstream details", async () => {
    const requestMarkets = vi.fn()
      .mockRejectedValueOnce(new Error("private upstream detail"))
      .mockResolvedValueOnce(result([event("recovered")]));
    renderDiscovery(requestMarkets);

    expect(await screen.findByRole("alert")).toHaveTextContent("Market schedules are temporarily unavailable");
    expect(screen.queryByText("private upstream detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry market schedules" }));
    expect(await screen.findByRole("heading", { name: "Market recovered" })).toBeInTheDocument();
    await waitFor(() => expect(requestMarkets).toHaveBeenCalledTimes(2));
  });
});
