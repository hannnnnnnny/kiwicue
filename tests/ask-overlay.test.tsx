import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskOverlay } from "../components/ask/ask-overlay";
import { LanguageProvider } from "../components/language-provider";
import { EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

const asking = { reply: "Fun! Who's coming along?", quickReplies: ["Kids", "Friends"], ready: false, summary: null, searchText: null, remaining: 5 };
const proposing = { reply: "Great, here's my plan.", quickReplies: [], ready: true, summary: "Sat 3 Oct · with kids", searchText: "Saturday with the kids", remaining: 5 };
const card = { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 };
const searchEvents: AskStreamEvent[] = [
  { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card }, { type: "best", id: "a" },
  { type: "reply", delta: "Bundle Baby suits little ones." }, { type: "done", remaining: 4, tier: "guest" },
];

function server(turns: Array<Record<string, unknown>>, search: AskStreamEvent[] = searchEvents, searchStatus = 200) {
  const queue = [...turns];
  return vi.fn<typeof fetch>(async (input) => String(input) === "/api/ask/chat"
    ? new Response(JSON.stringify(queue.shift()))
    : new Response(search.map((event) => JSON.stringify(event)).join("\n"), { status: searchStatus }));
}

function renderOverlay(fetchImpl: typeof fetch, onClose = vi.fn()) {
  return render(<LanguageProvider><AskOverlay onClose={onClose} fetchImpl={fetchImpl} /></LanguageProvider>);
}

function say(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Message Kiwi" }), { target: { value: text } });
  fireEvent.submit(screen.getByRole("form", { name: "Message Kiwi" }));
}

// Streamed answers pass through several async steps; allow for a busy test runner.
const SLOW = { timeout: 3000 };

afterEach(() => { cleanup(); localStorage.clear(); });

describe("AskOverlay chat", () => {
  it("greets, asks, proposes, and searches only after confirmation", async () => {
    const fetchImpl = server([asking, proposing]);
    renderOverlay(fetchImpl);
    expect(screen.getByRole("dialog", { name: "Kiwi" })).toBeVisible();
    expect(screen.getByText("Hi, I'm Kiwi! What are you in the mood for in Auckland?")).toBeVisible();

    say("Something this Saturday");
    expect(await screen.findByText("Fun! Who's coming along?", {}, SLOW)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Kids" }));
    const proposal = await screen.findByRole("group", { name: "I'll search for" }, SLOW);
    expect(within(proposal).getByText("Sat 3 Oct · with kids")).toBeVisible();
    expect(fetchImpl.mock.calls.filter(([url]) => url === "/api/ask")).toHaveLength(0);

    fireEvent.click(within(proposal).getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("article", { name: /Best match: Bundle Baby/ }, SLOW)).toBeVisible();
    expect(screen.getByText("Bundle Baby suits little ones.")).toBeVisible();
    const searchBody = JSON.parse(String(fetchImpl.mock.calls.find(([url]) => url === "/api/ask")?.[1]?.body));
    expect(searchBody).toMatchObject({ text: "Saturday with the kids", previous: null, history: ["Something this Saturday", "Kids"] });
    expect(screen.getByText("4 free searches left today")).toBeVisible();
  });

  it("shows loosened chips struck through and labels the closest alternatives", async () => {
    const relaxedSearch: AskStreamEvent[] = [
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true, area: "central" }, chips: [{ key: "area", label: "Central" }, { key: "kids", label: "With kids" }] },
      { type: "relaxed", keys: ["area"] }, ...searchEvents.slice(1),
    ];
    renderOverlay(server([proposing], relaxedSearch));
    say("Saturday with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "Search" }, SLOW));
    expect(await screen.findByText("No exact match — here are the closest.", {}, SLOW)).toBeVisible();
    expect(screen.getByText("Central (loosened)").closest("[data-relaxed]")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Central" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove With kids" })).toBeVisible();
  });

  it("goes back to chatting when the visitor wants to change the plan", async () => {
    renderOverlay(server([proposing]));
    say("Saturday with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "Change something" }, SLOW));
    expect(screen.getByText("Sure — what would you like to change?")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Search" })).not.toBeInTheDocument();
  });

  it("explains chat errors and offers sign-in when searches run out", async () => {
    renderOverlay(server([proposing], [{ type: "error", code: "quota_exhausted", message: "You've used today's free questions." }], 429));
    say("Saturday with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "Search" }, SLOW));
    expect(await screen.findByRole("alert", {}, SLOW)).toHaveTextContent("You've used today's free questions.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("offers typing only when speech is unsupported, and closes on Escape", async () => {
    const onClose = vi.fn();
    renderOverlay(server([]), onClose);
    expect(screen.queryByRole("button", { name: "Talk to Kiwi" })).not.toBeInTheDocument();
    expect(screen.getByText("Voice isn't supported in this browser. Type instead.")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("can be muted and remembers it", () => {
    renderOverlay(server([]));
    const mute = screen.getByRole("button", { name: "Mute Kiwi" });
    fireEvent.click(mute);
    expect(screen.getByRole("button", { name: "Unmute Kiwi" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("kiwicue.ask.muted")).toBe("1");
  });

  it("speaks Chinese", () => {
    localStorage.setItem("kiwicue-language", "zh");
    renderOverlay(server([]));
    expect(screen.getByText("嗨，我是 Kiwi！想在奥克兰找点什么好玩的？")).toBeVisible();
    expect(screen.getByRole("button", { name: "这个周末去哪玩" })).toBeVisible();
  });
});
