import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskOverlay } from "../components/ask/ask-overlay";
import { LanguageProvider } from "../components/language-provider";
import { EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

const cards = [
  { kind: "event" as const, id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 },
  { kind: "movie" as const, id: "movie:paw", title: "Paw Patrol", when: "2026-10-03T02:00:00.000Z", venue: "HOYTS Sylvia Park", href: "/movies?q=Paw%20Patrol", imageUrl: null, priceText: null, sessionCount: 4, score: 0.6 },
];

function stream(events: AskStreamEvent[], status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(events.map((event) => JSON.stringify(event)).join("\n"), { status }));
}

function renderOverlay(fetchImpl: typeof fetch, onClose = vi.fn()) {
  return render(<LanguageProvider><AskOverlay onClose={onClose} fetchImpl={fetchImpl} /></LanguageProvider>);
}

function askText(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Ask anything" }), { target: { value: text } });
  fireEvent.submit(screen.getByRole("search"));
}

afterEach(() => { cleanup(); localStorage.clear(); });

describe("AskOverlay", () => {
  it("asks by text and shows chips, the best match, other results and the reply", async () => {
    renderOverlay(stream([
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [{ key: "kids", label: "With kids" }] },
      { type: "result", card: cards[0] }, { type: "result", card: cards[1] }, { type: "best", id: "a" },
      { type: "reply", delta: "Bundle Baby suits little ones." }, { type: "done", remaining: 4, tier: "guest" },
    ]));
    expect(screen.getByRole("dialog", { name: "Ask KiwiCue" })).toBeVisible();
    askText("something for kids");
    const best = await screen.findByRole("article", { name: /Best match: Bundle Baby/ });
    expect(within(best).getByRole("link", { name: /Bundle Baby/ })).toHaveAttribute("href", "/events/a");
    expect(within(best).getByText("Free")).toBeVisible();
    expect(within(best).getByText("15 sessions")).toBeVisible();
    expect(screen.getByRole("link", { name: /Paw Patrol/ })).toHaveAttribute("href", "/movies?q=Paw%20Patrol");
    expect(screen.getByText("Bundle Baby suits little ones.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove With kids" })).toBeVisible();
    expect(screen.getByText("4 free questions left today")).toBeVisible();
  });

  it("offers typing only when speech is unsupported", () => {
    renderOverlay(stream([]));
    expect(screen.queryByRole("button", { name: "Start speaking" })).not.toBeInTheDocument();
    expect(screen.getByText("Voice isn't supported in this browser. Type your question instead.")).toBeVisible();
  });

  it("shows the quota error with a sign-in link and closes on Escape", async () => {
    const onClose = vi.fn();
    renderOverlay(stream([{ type: "error", code: "quota_exhausted", message: "You've used today's free questions." }], 429), onClose);
    askText("hi");
    expect(await screen.findByRole("alert")).toHaveTextContent("You've used today's free questions.");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows an empty state with a broaden suggestion", async () => {
    renderOverlay(stream([{ type: "understood", filters: EMPTY_FILTERS, chips: [] }, { type: "done", remaining: 3, tier: "guest" }]));
    askText("opera on mars");
    expect(await screen.findByText("Nothing matched. Try removing a filter or asking more broadly.")).toBeVisible();
  });

  it("renders the Chinese copy", () => {
    localStorage.setItem("kiwicue-language", "zh");
    renderOverlay(stream([]));
    expect(screen.getByRole("dialog", { name: "问问 KiwiCue" })).toBeVisible();
  });
});
