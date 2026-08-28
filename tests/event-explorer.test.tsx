import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventExplorer } from "../app/events/event-explorer";
import { LanguageProvider } from "../components/language-provider";
import { LanguageToggle } from "../components/language-toggle";
import type { EventCategory } from "../lib/event-categories";
import type { AucklandEventsResult } from "../lib/events";
import type { EventWindow } from "../lib/event-window";
import { readApplicationCss } from "./css-source";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const projectRoot = resolve(import.meta.dirname, "..");
const eventResult = {
  events: [
    {
      id: "event-1",
      name: "Harbour Lights",
      url: "https://www.ticketmaster.co.nz/event/event-1",
      imageUrl: "https://img.example/harbour.jpg",
      start: {
        localDate: "2026-08-01",
        localTime: "19:30:00",
        dateTime: "2026-08-01T07:30:00Z",
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
        coordinates: null,
      },
    },
  ],
  page: { size: 1, totalElements: 1, totalPages: 1, number: 0 },
  nextCursor: null,
};

type RequestEvents = (options: {
  window?: EventWindow;
  category?: EventCategory;
  keyword?: string;
  venueId?: string;
  cursor?: string;
}) => Promise<AucklandEventsResult>;

function numberedEvent(index: number) {
  return {
    ...eventResult.events[0],
    id: `event-${index}`,
    name: `Event ${index}`,
    url: `https://www.ticketmaster.co.nz/event/event-${index}`,
  };
}

function pagedResult(
  events: ReturnType<typeof numberedEvent>[],
  totalElements: number,
  nextCursor: string | null,
): AucklandEventsResult {
  return {
    events,
    page: {
      size: 50,
      totalElements,
      totalPages: Math.ceil(totalElements / 50),
      number: nextCursor ? 0 : 1,
    },
    nextCursor,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  router.push.mockReset();
  vi.unstubAllGlobals();
});

function renderChineseExplorer(requestEvents: RequestEvents) {
  render(
    <LanguageProvider>
      <LanguageToggle />
      <EventExplorer requestEvents={requestEvents} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
}

describe("Auckland event explorer", () => {
  it("provides a route and a client-side explorer", () => {
    expect(existsSync(resolve(projectRoot, "app/events/page.tsx"))).toBe(true);
    expect(existsSync(resolve(projectRoot, "app/events/event-explorer.tsx"))).toBe(true);
  });

  it("exports the interactive event explorer", async () => {
    const explorerModule = await import("../app/events/event-explorer");
    expect(explorerModule.EventExplorer).toBeTypeOf("function");
  });

  it("frames the feed as an all-upcoming Auckland briefing", async () => {
    const pageModule = await import("../app/events/page");
    expect(pageModule.default).toBeTypeOf("function");

    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));
    const EventsPage = pageModule.default;
    const page = await EventsPage();
    render(page);

    expect(screen.getByRole("heading", { name: "Find something worth doing." })).toBeInTheDocument();
    expect(screen.getByText("Discover Auckland")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "KiwiCue Auckland events home" })).toHaveAttribute("href", "/");
  });

  it("shows an immediate loading signal while Auckland events are requested", () => {
    const requestEvents = vi.fn(() => new Promise<never>(() => undefined));

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(screen.getByRole("status")).toHaveTextContent("Scanning Auckland for what is next");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".event-card-skeleton")).toHaveLength(8);
    expect(document.querySelector(".loading-pulse")).not.toBeInTheDocument();
    expect(requestEvents).toHaveBeenCalledOnce();
  });

  it("renders useful event details and the internal detail link", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("Sat, 1 Aug · 7:30 pm")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.getByText("The Civic · Auckland")).toBeInTheDocument();
    expect(screen.getByText("1 upcoming Ticketmaster event · 1 shown")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Harbour Lights details" })).toHaveAttribute(
      "href",
      "/events/event-1",
    );
  });

  it("renders editorial discovery by default and focused results for filters", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);
    const view = render(<EventExplorer requestEvents={requestEvents} />);
    expect(await screen.findByRole("heading", { name: "Start here" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Explore by mood" })).toBeVisible();
    expect(screen.queryByText(/popular|trending/i)).not.toBeInTheDocument();

    view.rerender(<EventExplorer keyword="Harbour" requestEvents={requestEvents} />);
    expect(await screen.findByRole("heading", { name: "Results for “Harbour”" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Start here" })).not.toBeInTheDocument();
  });

  it("shows the full upcoming Ticketmaster total and an explicit remaining count", async () => {
    const requestEvents = vi.fn().mockResolvedValue(
      pagedResult(Array.from({ length: 50 }, (_, index) => numberedEvent(index + 1)), 81, "page-two"),
    );

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "Event 1" })).toBeInTheDocument();
    expect(screen.getByText("81 upcoming Ticketmaster events · 50 shown")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 31 more events" })).toBeInTheDocument();
    expect(requestEvents).toHaveBeenCalledWith({});
  });

  it("appends, deduplicates, and announces when every event is shown", async () => {
    const first = pagedResult(
      Array.from({ length: 50 }, (_, index) => numberedEvent(index + 1)),
      81,
      "page-two",
    );
    const second = pagedResult(
      Array.from({ length: 32 }, (_, index) => numberedEvent(index + 50)),
      81,
      null,
    );
    const requestEvents = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    render(<EventExplorer requestEvents={requestEvents} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show 31 more events" }));

    expect(await screen.findByRole("heading", { name: "Event 81" })).toBeInTheDocument();
    expect(document.querySelectorAll(".portal-event-card h2")).toHaveLength(81);
    expect(screen.getAllByRole("heading", { name: "Event 50" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Show 31 more events" })).not.toBeInTheDocument();
    expect(screen.getByText("All Ticketmaster events are shown")).toBeInTheDocument();
    expect(requestEvents).toHaveBeenNthCalledWith(2, { cursor: "page-two" });
  });

  it("requests applied activity, venue, and category filters", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);

    render(
      <EventExplorer
        window="weekend"
        category="concerts"
        keyword="Taylor Swift"
        venueId="venue-1"
        requestEvents={requestEvents}
      />,
    );

    await screen.findByRole("heading", { name: "Harbour Lights" });
    expect(requestEvents).toHaveBeenCalledWith({
      window: "weekend",
      category: "concerts",
      keyword: "Taylor Swift",
      venueId: "venue-1",
    });
    expect(screen.getByText("1 matching Ticketmaster event · 1 shown")).toBeInTheDocument();
  });

  it("retains every applied filter when appending", async () => {
    const requestEvents = vi.fn()
      .mockResolvedValueOnce(pagedResult([numberedEvent(1)], 2, "page-two"))
      .mockResolvedValueOnce(pagedResult([numberedEvent(2)], 2, null));

    render(
      <EventExplorer
        window="weekend"
        category="concerts"
        keyword="Taylor Swift"
        venueId="venue-1"
        requestEvents={requestEvents}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Show 1 more event" }));

    expect(await screen.findByRole("heading", { name: "Event 2" })).toBeInTheDocument();
    expect(requestEvents).toHaveBeenNthCalledWith(2, {
      window: "weekend",
      category: "concerts",
      keyword: "Taylor Swift",
      venueId: "venue-1",
      cursor: "page-two",
    });
  });

  it("allows only one append request at a time", async () => {
    const append = deferred<AucklandEventsResult>();
    const requestEvents = vi.fn()
      .mockResolvedValueOnce(pagedResult([numberedEvent(1)], 2, "page-two"))
      .mockImplementationOnce(() => append.promise);

    render(<EventExplorer requestEvents={requestEvents} />);
    const button = await screen.findByRole("button", { name: "Show 1 more event" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(requestEvents).toHaveBeenCalledTimes(2);
    expect(button).toBeDisabled();
    append.resolve(pagedResult([numberedEvent(2)], 2, null));
    expect(await screen.findByText("All Ticketmaster events are shown")).toBeInTheDocument();
  });

  it("keeps visible cards when append fails and retries the same cursor", async () => {
    const requestEvents = vi.fn()
      .mockResolvedValueOnce(pagedResult([numberedEvent(1)], 2, "page-two"))
      .mockRejectedValueOnce(new Error("private append failure"))
      .mockResolvedValueOnce(pagedResult([numberedEvent(2)], 2, null));

    render(<EventExplorer requestEvents={requestEvents} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show 1 more event" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Loading more events failed. Your shown events are still here.",
    );
    expect(screen.getByRole("heading", { name: "Event 1" })).toBeInTheDocument();
    expect(screen.queryByText("private append failure")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading more events" }));
    expect(await screen.findByRole("heading", { name: "Event 2" })).toBeInTheDocument();
    expect(requestEvents).toHaveBeenNthCalledWith(3, { cursor: "page-two" });
  });

  it("ignores a stale append after the category changes", async () => {
    const staleAppend = deferred<AucklandEventsResult>();
    const requestEvents = vi.fn<RequestEvents>(async (options) => {
      if (options.category === "markets") {
        return pagedResult([
          { ...numberedEvent(90), name: "Market event" },
        ], 1, null);
      }
      if (options.cursor) return staleAppend.promise;
      return pagedResult([
        { ...numberedEvent(1), name: "Concert event" },
      ], 2, "concert-page-two");
    });
    const view = render(
      <LanguageProvider>
        <EventExplorer category="concerts" requestEvents={requestEvents} />
      </LanguageProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Show 1 more event" }));
    view.rerender(
      <LanguageProvider>
        <EventExplorer category="markets" requestEvents={requestEvents} />
      </LanguageProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Market event" })).toBeInTheDocument();

    staleAppend.resolve(pagedResult([
      { ...numberedEvent(2), name: "Stale concert event" },
    ], 2, null));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Stale concert event" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Concert event" })).not.toBeInTheDocument();
  });

  it("ignores a stale result after the activity search changes", async () => {
    const stale = deferred<AucklandEventsResult>();
    const requestEvents = vi.fn<RequestEvents>((options) =>
      options.keyword === "old"
        ? stale.promise
        : Promise.resolve(pagedResult([{ ...numberedEvent(2), name: "New result" }], 1, null)),
    );
    const view = render(<EventExplorer keyword="old" requestEvents={requestEvents} />);

    view.rerender(<EventExplorer keyword="new" requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "New result" })).toBeInTheDocument();
    stale.resolve(pagedResult([{ ...numberedEvent(1), name: "Old result" }], 1, null));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Old result" })).not.toBeInTheDocument();
    });
  });

  it("focuses the result summary once after a submitted search", async () => {
    sessionStorage.setItem("kiwicue:focus-results", "1");
    const requestEvents = vi.fn().mockResolvedValue(eventResult);
    const view = render(<EventExplorer keyword="Taylor" requestEvents={requestEvents} />);

    const summary = await screen.findByText("1 matching Ticketmaster event · 1 shown");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(summary).toHaveAttribute("id", "event-results-summary");
    expect(summary).toHaveAttribute("tabindex", "-1");
    expect(sessionStorage.getItem("kiwicue:focus-results")).toBeNull();

    const detailLink = screen.getByRole("link", { name: "View Harbour Lights details" });
    detailLink.focus();
    view.rerender(<EventExplorer keyword="Taylor" requestEvents={requestEvents} />);
    expect(detailLink).toHaveFocus();
  });

  it("does not steal focus on a first visit", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);
    render(
      <>
        <button type="button">Existing focus</button>
        <EventExplorer requestEvents={requestEvents} />
      </>,
    );
    const existingFocus = screen.getByRole("button", { name: "Existing focus" });
    existingFocus.focus();

    await screen.findByText("1 upcoming Ticketmaster event · 1 shown");
    expect(existingFocus).toHaveFocus();
  });

  it("uses bilingual upcoming totals, remaining count, and completion copy", async () => {
    const requestEvents = vi.fn()
      .mockResolvedValueOnce(pagedResult([numberedEvent(1)], 2, "page-two"))
      .mockResolvedValueOnce(pagedResult([numberedEvent(2)], 2, null));
    render(
      <LanguageProvider>
        <LanguageToggle />
        <EventExplorer requestEvents={requestEvents} />
      </LanguageProvider>,
    );

    await screen.findByRole("heading", { name: "Event 1" });
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
    expect(screen.getByText("Ticketmaster 当前可查 2 个未来活动 · 已显示 1 个")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "再显示 1 个活动" }));
    expect(await screen.findByText("Ticketmaster 活动已全部显示")).toBeInTheDocument();
  });

  it("describes curated market results without Ticketmaster claims in both languages", async () => {
    const marketResult: AucklandEventsResult = {
      ...eventResult,
      events: [{
        ...eventResult.events[0],
        id: "kc-market-grey-lynn",
        category: "Market",
        status: "schedule_verified",
      }],
    };
    const requestEvents = vi.fn().mockResolvedValue(marketResult);
    render(
      <LanguageProvider>
        <LanguageToggle />
        <EventExplorer category="markets" requestEvents={requestEvents} />
      </LanguageProvider>,
    );

    expect(await screen.findByText("1 verified market schedule · 1 shown")).toBeInTheDocument();
    expect(screen.getByText("Verified official market links")).toBeInTheDocument();
    expect(screen.getByText("All verified market schedules are shown")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Ticketmaster");

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));
    expect(screen.getByText("已核实 1 个市集日程 · 已显示 1 个")).toBeInTheDocument();
    expect(screen.getByText("包含已核实的市集官方链接")).toBeInTheDocument();
    expect(screen.getByText("已核实的市集日程已全部显示")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Ticketmaster");
  });

  it("keeps the Chinese append failure safe and retryable", async () => {
    const requestEvents = vi.fn()
      .mockResolvedValueOnce(pagedResult([numberedEvent(1)], 2, "page-two"))
      .mockRejectedValueOnce(new Error("private append failure"));

    renderChineseExplorer(requestEvents);
    fireEvent.click(await screen.findByRole("button", { name: "再显示 1 个活动" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "加载更多活动失败，已显示的活动仍会保留。",
    );
    expect(screen.getByRole("heading", { name: "Event 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新加载更多活动" })).toBeInTheDocument();
    expect(screen.queryByText("private append failure")).not.toBeInTheDocument();
  });

  it("gives the load-more control a large touch target", () => {
    const css = readApplicationCss();

    expect(css).toMatch(/\.event-state button,[\s\S]*?\.event-load-more\s*\{[^}]*min-height:\s*52px/s);
    expect(css).toMatch(/\.event-load-more\s*\{[^}]*width:\s*min\(100%,\s*420px\)/s);
  });

  it("explains an empty result without presenting it as an error", async () => {
    const requestEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    render(<EventExplorer requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "No upcoming events found" })).toBeInTheDocument();
    expect(screen.getByText("Check back soon—new Auckland events are added throughout the week.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear all filters" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains an empty filtered result without implying a technical error", async () => {
    const requestEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 50, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    render(<EventExplorer keyword="NoSuchActivity" requestEvents={requestEvents} />);

    expect(await screen.findByRole("heading", { name: "No matching events found" })).toBeInTheDocument();
    expect(screen.getByText("Try changing or clearing your filters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute("href", "/events");
    expect(screen.queryByText(/temporarily|unavailable|technical/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers a retry after a safe error and can recover", async () => {
    const requestEvents = vi.fn()
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce(eventResult);

    render(<EventExplorer requestEvents={requestEvents} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Auckland events are temporarily out of range");
    expect(alert).not.toHaveTextContent("private network details");

    fireEvent.click(screen.getByRole("button", { name: "Retry event scan" }));

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(requestEvents).toHaveBeenCalledTimes(2);
  });

  it("loads through the same-origin KiwiCue API instead of Ticketmaster", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(eventResult), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<EventExplorer />);

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events?size=50",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("ticketmaster.com");
  });

  it("requests and appends every filter from the same-origin API in a fixed order", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(pagedResult([numberedEvent(1)], 2, "page two")),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(pagedResult([numberedEvent(2)], 2, null)),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventExplorer
        window="weekend"
        category="concerts"
        keyword="Taylor Swift"
        venueId="venue-1"
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Show 1 more event" }));
    expect(await screen.findByRole("heading", { name: "Event 2" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events?size=50&window=weekend&category=concerts&q=Taylor+Swift&venue=venue-1",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events?size=50&window=weekend&category=concerts&q=Taylor+Swift&venue=venue-1&cursor=page+two",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("does not refetch when only the interface language changes", async () => {
    const requestEvents = vi.fn().mockResolvedValue(eventResult);
    render(
      <LanguageProvider>
        <LanguageToggle />
        <EventExplorer category="concerts" requestEvents={requestEvents} />
      </LanguageProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(requestEvents).toHaveBeenCalledTimes(1);
    expect(requestEvents).toHaveBeenCalledWith({ category: "concerts" });
  });

  it("uses matching empty-result copy in both languages", async () => {
    const requestEvents = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });
    render(
      <LanguageProvider>
        <LanguageToggle />
        <EventExplorer category="markets" requestEvents={requestEvents} />
      </LanguageProvider>,
    );

    expect(await screen.findByRole("heading", { name: "No matching events found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "没有找到匹配的活动" })).toBeInTheDocument();
    expect(screen.getByText("请更改或清除筛选条件后再试。")).toBeInTheDocument();
  });

  it("switches the loading and event-detail states to Chinese", async () => {
    const pendingRequest = vi.fn(() => new Promise<typeof eventResult>(() => undefined));

    renderChineseExplorer(pendingRequest);

    expect(screen.getByRole("status")).toHaveTextContent("正在扫描奥克兰近期活动");

    cleanup();
    localStorage.clear();
    document.documentElement.lang = "en";
    const readyRequest = vi.fn().mockResolvedValue(eventResult);
    renderChineseExplorer(readyRequest);

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(screen.getByText("8月1日周六 · 19:30")).toBeInTheDocument();
    expect(screen.getByText("Ticketmaster 当前可查 1 个未来活动 · 已显示 1 个")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看 Harbour Lights 详情" })).toHaveAttribute(
      "href",
      "/events/event-1",
    );
  });

  it("switches empty and recoverable error states to Chinese", async () => {
    const emptyRequest = vi.fn().mockResolvedValue({
      events: [],
      page: { size: 24, totalElements: 0, totalPages: 0, number: 0 },
      nextCursor: null,
    });

    renderChineseExplorer(emptyRequest);

    expect(await screen.findByRole("heading", { name: "暂时没有未来活动" })).toBeInTheDocument();

    cleanup();
    localStorage.clear();
    document.documentElement.lang = "en";
    const recoverableRequest = vi.fn()
      .mockRejectedValueOnce(new Error("private network details"))
      .mockResolvedValueOnce(eventResult);
    renderChineseExplorer(recoverableRequest);

    expect(await screen.findByRole("heading", { name: "暂时无法获取奥克兰活动" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新扫描活动" }));

    expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeInTheDocument();
    expect(recoverableRequest).toHaveBeenCalledTimes(2);
  });
});
