import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSearchPanel } from "../components/event-search-panel";
import { LanguageProvider } from "../components/language-provider";
import { LanguageToggle } from "../components/language-toggle";

const projectRoot = resolve(import.meta.dirname, "..");
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
    const css = readFileSync(resolve(projectRoot, "app/globals.css"), "utf8");
    expect(css).toMatch(/\.event-search-input\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.event-search-select\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/\.event-search-submit\s*\{[^}]*min-height:\s*56px/s);
    expect(css).toMatch(/@media \(max-width:\s*620px\)[\s\S]*\.event-search-fields\s*\{[^}]*grid-template-columns:\s*1fr/s);
  });

  it("loads alphabetized venues and initializes applied values", async () => {
    renderPanel({ category: "concerts", keyword: "Taylor", venueId: "s" });

    expect(screen.getByLabelText("Activity name")).toHaveValue("Taylor");
    expect(screen.getByLabelText("Activity name")).toHaveClass("event-search-input");
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
    expect(screen.getByText("输入完整的活动或艺人名称，例如 Taylor")).toBeInTheDocument();
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
