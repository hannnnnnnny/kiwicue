import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSearchPanel } from "../components/event-search-panel";
import { LanguageProvider } from "../components/language-provider";
import { LanguageToggle } from "../components/language-toggle";
import { readApplicationCss } from "./css-source";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

function venueResponse(venues = [
  { id: "s", name: "Spark Arena" },
  { id: "a", name: "Aotea Centre" },
]) {
  return new Response(JSON.stringify({ venues }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function suggestionResponse(
  name = "Laufey - A Matter Of Time Tour",
  venueName = "Spark Arena",
) {
  return new Response(JSON.stringify({
    suggestions: [{
      name,
      category: "Music",
      localDate: "2026-08-14",
      venueName,
    }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function renderPanel(
  props: {
    window?: "7d" | "weekend" | "30d" | "all";
    category: "concerts" | null;
    keyword: string | null;
    venueId: string | null;
  } = { category: null, keyword: null, venueId: null },
) {
  return render(
    <LanguageProvider>
      <LanguageToggle />
      <EventSearchPanel window={props.window ?? "all"} category={props.category} keyword={props.keyword} venueId={props.venueId} />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.lang = "en";
  router.push.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(venueResponse()));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventSearchPanel", () => {
  it("provides large controls and a narrow-screen stack", () => {
    const css = readApplicationCss();
    expect(css).toMatch(/\.event-search-input,[\s\S]*min-height:\s*52px/s);
    expect(css).toMatch(/@media \(max-width:\s*600px\)[\s\S]*\.event-search-fields\s*\{[^}]*grid-template-columns:\s*1fr/s);
  });

  it("loads alphabetized venues and initializes applied values", async () => {
    renderPanel({ category: "concerts", keyword: "Taylor", venueId: "s" });

    expect(screen.getByLabelText("Activity name")).toHaveValue("Taylor");
    expect(screen.getByLabelText("Activity name")).toHaveClass("event-search-input");
    expect(screen.getByLabelText("Activity name")).toHaveAttribute("maxlength", "100");
    expect(screen.getByLabelText("Activity name")).toHaveAttribute("placeholder", "Artist, concert, market…");
    expect(screen.getByRole("search", { name: "Search Auckland events" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Venue")).toHaveValue("s");
    expect(screen.getByLabelText("Venue")).toHaveClass("event-search-select");
    expect(screen.getByRole("button", { name: "Search events" })).toHaveClass(
      "event-search-submit",
    );
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "All venues",
      "Aotea Centre",
      "Spark Arena",
    ]);
  });

  it("submits one canonical combined search by button or Enter", async () => {
    renderPanel({ category: "concerts", keyword: null, venueId: null });

    fireEvent.change(screen.getByLabelText("Activity name"), {
      target: { value: "  Taylor   Swift " },
    });
    fireEvent.change(await screen.findByLabelText("Venue"), {
      target: { value: "s" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(
      "/events?category=concerts&q=Taylor+Swift&venue=s",
    );
    expect(sessionStorage.getItem("kiwicue:focus-results")).toBe("1");
    expect(screen.getByRole("button", { name: "Searching events" })).toBeDisabled();
  });

  it("suggests a partial event name and selects it with the keyboard", async () => {
    const request = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      return Promise.resolve(url.startsWith("/api/events/suggestions")
        ? suggestionResponse()
        : venueResponse());
    });
    vi.stubGlobal("fetch", request);
    renderPanel({ window: "30d", category: "concerts", keyword: null, venueId: null });

    const input = screen.getByLabelText("Activity name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "lauf" } });

    const option = await screen.findByRole("option", {
      name: /Laufey - A Matter Of Time Tour.*Spark Arena/i,
    });
    expect(input).toHaveAttribute("role", "combobox");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option.parentElement).toHaveAttribute("role", "listbox");
    expect(option).toHaveTextContent("14 Aug");

    const suggestionCall = request.mock.calls
      .map(([value]) => String(value))
      .find((url) => url.startsWith("/api/events/suggestions"));
    expect(suggestionCall).toBeDefined();
    const params = new URL(suggestionCall ?? "", "http://localhost").searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q: "lauf",
      window: "30d",
      category: "concerts",
    });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(router.push).toHaveBeenCalledWith(
      "/events?window=30d&category=concerts&q=Laufey+-+A+Matter+Of+Time+Tour",
    );
  });

  it("does not let a slower old response replace newer suggestions", async () => {
    let resolveLaufey: ((response: Response) => void) | undefined;
    const delayedLaufey = new Promise<Response>((resolve) => {
      resolveLaufey = resolve;
    });
    const request = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("q=lauf")) return delayedLaufey;
      if (url.includes("q=lorde")) {
        return Promise.resolve(suggestionResponse("Lorde - Ultrasound Tour", "Eden Park"));
      }
      return Promise.resolve(venueResponse());
    });
    vi.stubGlobal("fetch", request);
    renderPanel({ window: "all", category: null, keyword: null, venueId: null });

    const input = screen.getByLabelText("Activity name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "lauf" } });
    await waitFor(() => expect(request.mock.calls.some(([value]) => String(value).includes("q=lauf"))).toBe(true));

    fireEvent.change(input, { target: { value: "lorde" } });
    expect(await screen.findByRole("option", { name: /Lorde - Ultrasound Tour/i })).toBeInTheDocument();
    await act(async () => {
      resolveLaufey?.(suggestionResponse());
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Lorde - Ultrasound Tour/i })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /Laufey/i })).not.toBeInTheDocument();
    });
  });

  it("announces an empty suggestion result without exposing an expanded empty listbox", async () => {
    const request = vi.fn((input: RequestInfo | URL) => Promise.resolve(
      String(input).startsWith("/api/events/suggestions")
        ? new Response(JSON.stringify({ suggestions: [] }), { status: 200 })
        : venueResponse(),
    ));
    vi.stubGlobal("fetch", request);
    renderPanel();

    const input = screen.getByLabelText("Activity name");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzzz" } });

    expect(await screen.findByText(
      "No matching event names yet. You can still search this text.",
    )).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByText(
      "No matching event names yet. You can still search this text.",
    )).not.toBeInTheDocument();
  });

  it.each([
    { keyword: "Taylor", venueId: null },
    { keyword: null, venueId: "s" },
  ] as const)("keeps category while clearing an applied $keyword/$venueId filter", (filters) => {
    renderPanel({ category: "concerts", ...filters });

    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/events?category=concerts",
    );
  });

  it("omits clear when no activity or venue filter is applied", () => {
    renderPanel({ category: "concerts", keyword: null, venueId: null });

    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("keeps name search usable when venues fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private")));
    renderPanel();

    expect(await screen.findByText("Venue temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Activity name")).toBeEnabled();
    expect(screen.getByLabelText("Venue")).toBeDisabled();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it.each([
    ["a non-OK response", new Response("private", { status: 503 })],
    ["a malformed response", new Response(JSON.stringify({
      venues: [{ id: "safe", name: "Safe venue" }, { id: 42, name: "private" }],
    }))],
  ])("uses the safe unavailable state for %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    renderPanel();

    expect(await screen.findByText("Venue temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Venue")).toBeDisabled();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Safe venue" })).not.toBeInTheDocument();
  });

  it("switches every control to Chinese without requesting venues again", async () => {
    const requestVenues = vi.fn().mockResolvedValue(venueResponse());
    vi.stubGlobal("fetch", requestVenues);
    renderPanel({ category: "concerts", keyword: "Taylor", venueId: "s" });

    expect(await screen.findByRole("option", { name: "All venues" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("search", { name: "搜索奥克兰活动" })).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toHaveValue("Taylor");
    expect(screen.getByText("输入活动或艺人名称的一部分，例如 lauf")).toBeInTheDocument();
    expect(screen.getByLabelText("场馆")).toHaveValue("s");
    expect(screen.getByRole("option", { name: "所有场馆" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索活动" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "清除筛选" })).toBeInTheDocument();
    expect(requestVenues).toHaveBeenCalledTimes(1);

    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("button", { name: "正在搜索活动" })).toBeDisabled();
  });

  it("shows a safe Chinese venue failure while preserving name search", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private")));
    localStorage.setItem("kiwicue-language", "zh");
    renderPanel();

    expect(await screen.findByText("场馆暂时不可用")).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toBeEnabled();
    expect(screen.getByLabelText("场馆")).toBeDisabled();
  });

  it("resets drafts for applied URL values and unlocks an identical navigation", async () => {
    const view = renderPanel({ category: "concerts", keyword: "Taylor", venueId: "s" });
    await screen.findByRole("option", { name: "Spark Arena" });

    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("button", { name: "Searching events" })).toBeDisabled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Search events" })).toBeEnabled();
    });

    fireEvent.change(screen.getByLabelText("Activity name"), {
      target: { value: "Lorde" },
    });
    view.rerender(
      <LanguageProvider>
        <EventSearchPanel window="all" category="concerts" keyword="Benee" venueId={null} />
      </LanguageProvider>,
    );

    expect(screen.getByLabelText("Activity name")).toHaveValue("Benee");
    expect(screen.getByLabelText("Venue")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Search events" })).toBeEnabled();
  });
});
