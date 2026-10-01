import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskOverlay } from "../components/ask/ask-overlay";
import { LanguageProvider } from "../components/language-provider";
import { EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 };
const searchEvents: AskStreamEvent[] = [
  { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card }, { type: "best", id: "a" },
  { type: "reply", delta: "Bundle Baby suits little ones." }, { type: "done", remaining: 14, tier: "guest" },
];

function server(searches: AskStreamEvent[][] = [searchEvents], status = 200) {
  const queue = [...searches];
  return vi.fn<typeof fetch>(async () => new Response((queue.shift() ?? searchEvents).map((event) => JSON.stringify(event)).join("\n"), { status }));
}

function renderOverlay(fetchImpl: typeof fetch, onClose = vi.fn()) {
  return render(<LanguageProvider><AskOverlay onClose={onClose} fetchImpl={fetchImpl} /></LanguageProvider>);
}

function say(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Message Kiwi" }), { target: { value: text } });
  fireEvent.submit(screen.getByRole("form", { name: "Message Kiwi" }));
}

const searchBodies = (fetchImpl: ReturnType<typeof server>) => fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

// Streamed answers pass through several async steps; allow for a busy test runner.
const SLOW = { timeout: 3000 };

afterEach(() => { cleanup(); localStorage.clear(); });

describe("AskOverlay", () => {
  it("shows results for the very first message, then asks what's missing", async () => {
    const fetchImpl = server();
    renderOverlay(fetchImpl);
    expect(screen.getByRole("dialog", { name: "Kiwi" })).toBeVisible();
    expect(screen.getByText("Hi, I'm Kiwi! What are you in the mood for in Auckland?")).toBeVisible();

    say("Something with the kids");
    expect(await screen.findByRole("article", { name: /Best match: Bundle Baby/ }, SLOW)).toBeVisible();
    expect(screen.getByText("Bundle Baby suits little ones.")).toBeVisible();
    expect(searchBodies(fetchImpl)[0]).toMatchObject({ text: "Something with the kids", previous: null });
    expect(await screen.findByText("Which day suits you?", {}, SLOW)).toBeVisible();
    expect(screen.getByText("14 free searches left today")).toBeVisible();
  });

  it("refines the current results with each further message and folds the earlier ones", async () => {
    const weekend: AskStreamEvent[] = [
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true, dates: ["2026-10-03", "2026-10-04"] }, chips: [{ key: "kids", label: "With kids" }, { key: "dates", label: "Sat 3 Oct – Sun 4 Oct" }] },
      ...searchEvents.slice(1),
    ];
    const fetchImpl = server([searchEvents, weekend]);
    renderOverlay(fetchImpl);
    say("Something with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "This weekend" }, SLOW));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2), SLOW);
    expect(searchBodies(fetchImpl)[1]).toMatchObject({ text: "This weekend", previous: { kids: true }, history: ["Something with the kids"] });
    expect(await screen.findByText("Any part of town you prefer?", {}, SLOW)).toBeVisible();
    expect(screen.getByText("Earlier · 1 result · With kids")).toBeVisible();
    expect(screen.getAllByRole("article", { name: /Best match/ })).toHaveLength(1);
    const earlier = screen.getByText("Earlier · 1 result · With kids").closest("details")!;
    earlier.open = true;
    fireEvent(earlier, new Event("toggle"));
    expect(await screen.findAllByRole("article", { name: /Best match/ })).toHaveLength(2);
  });

  it("starts over with a fresh search", async () => {
    const fetchImpl = server([searchEvents, searchEvents]);
    renderOverlay(fetchImpl);
    say("Something with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "Start over" }, SLOW));
    expect(screen.getByText("Sure — what are you after this time?")).toBeVisible();
    say("A movie");
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2), SLOW);
    expect(searchBodies(fetchImpl)[1]).toMatchObject({ text: "A movie", previous: null });
  });

  it("shows loosened chips struck through and labels the closest alternatives", async () => {
    renderOverlay(server([[
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true, area: "central" }, chips: [{ key: "area", label: "Central" }, { key: "kids", label: "With kids" }] },
      { type: "relaxed", keys: ["area"] }, ...searchEvents.slice(1),
    ]]));
    say("Kids stuff in the city");
    expect(await screen.findByText("No exact match — here are the closest.", {}, SLOW)).toBeVisible();
    expect(screen.getByText("Central (loosened)").closest("[data-relaxed]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Central" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove With kids" })).toBeVisible();
    expect(await screen.findByText("Nothing matched exactly, so these are the closest. Want to adjust?", {}, SLOW)).toBeVisible();
  });

  it("offers sign-in when searches run out", async () => {
    renderOverlay(server([[{ type: "error", code: "quota_exhausted", message: "You've used today's free questions." }]], 429));
    say("Saturday with the kids");
    expect(await screen.findByRole("alert", {}, SLOW)).toHaveTextContent("You've used today's free questions.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("offers typing only when speech is unsupported, and closes on Escape", async () => {
    const onClose = vi.fn();
    renderOverlay(server(), onClose);
    expect(screen.queryByRole("button", { name: "Talk to Kiwi" })).not.toBeInTheDocument();
    expect(screen.getByText("Voice isn't supported in this browser. Type instead.")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("can be muted and remembers it", () => {
    renderOverlay(server());
    fireEvent.click(screen.getByRole("button", { name: "Mute Kiwi" }));
    expect(screen.getByRole("button", { name: "Unmute Kiwi" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("kiwicue.ask.muted")).toBe("1");
  });

  it("speaks Chinese", () => {
    localStorage.setItem("kiwicue-language", "zh");
    renderOverlay(server());
    expect(screen.getByText("嗨，我是 Kiwi！想在奥克兰找点什么好玩的？")).toBeVisible();
    expect(screen.getByRole("button", { name: "这个周末去哪玩" })).toBeVisible();
  });
});
