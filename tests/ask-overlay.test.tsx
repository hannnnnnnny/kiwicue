import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskOverlay } from "../components/ask/ask-overlay";
import { LanguageProvider } from "../components/language-provider";
import { EMPTY_FILTERS, type AskStreamEvent } from "../lib/ask/schema";

const card = (id: string, title: string, when = "2026-10-03T10:00:00+13:00") =>
  ({ kind: "event" as const, id, title, when, venue: "Aotea Centre", href: `/events/${id}`, imageUrl: null, priceText: "Free", sessionCount: 1, score: 1 });
const searchEvents: AskStreamEvent[] = [
  { type: "understood", filters: { ...EMPTY_FILTERS, kids: true }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card: card("a", "Bundle Baby") }, { type: "best", id: "a" }, { type: "layout", layout: "grid" },
  { type: "reply", delta: "**Bundle Baby** is lovely for little ones.\n\n" }, { type: "reply", delta: "Want something outdoors too?" },
  { type: "done", remaining: 14, tier: "guest" },
];
const chatOnly: AskStreamEvent[] = [{ type: "reply", delta: "Yes — it's free, so no tickets needed." }, { type: "done", remaining: 13, tier: "guest" }];

function server(answers: AskStreamEvent[][] = [searchEvents], status = 200) {
  const queue = [...answers];
  return vi.fn<typeof fetch>(async () => new Response((queue.shift() ?? searchEvents).map((event) => JSON.stringify(event)).join("\n"), { status }));
}

function renderOverlay(fetchImpl: typeof fetch, onClose = vi.fn()) {
  return render(<LanguageProvider><AskOverlay onClose={onClose} fetchImpl={fetchImpl} /></LanguageProvider>);
}

function say(text: string, to = "Fern") {
  fireEvent.change(screen.getByRole("textbox", { name: `Message ${to}` }), { target: { value: text } });
  fireEvent.submit(screen.getByRole("form", { name: `Message ${to}` }));
}

const bodies = (fetchImpl: ReturnType<typeof server>) => fetchImpl.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

// Streamed answers pass through several async steps; allow for a busy test runner.
const SLOW = { timeout: 3000 };

afterEach(() => { cleanup(); localStorage.clear(); delete document.documentElement.dataset.assistant; });

describe("AskOverlay", () => {
  it("keeps a voice chat going after one tap, but never listens while the reply is spoken", async () => {
    const started = vi.fn();
    const utterances: Array<{ onend: (() => void) | null }> = [];
    class Recognition {
      static last: Recognition;
      lang = ""; interimResults = false; continuous = false;
      onresult: ((event: unknown) => void) | null = null; onerror = null; onend: (() => void) | null = null;
      constructor() { Recognition.last = this; }
      start = started; stop() { this.onend?.(); } abort() {}
    }
    class Utterance { lang = ""; voice = null; rate = 1; pitch = 1; onend = null; onerror = null; }
    vi.stubGlobal("webkitSpeechRecognition", Recognition);
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("speechSynthesis", { getVoices: () => [], cancel: vi.fn(), speak: (value: Utterance) => utterances.push(value) });
    try {
      const fetchImpl = server([chatOnly]);
      renderOverlay(fetchImpl);
      fireEvent.click(screen.getByRole("button", { name: "Start voice chat with Fern" }));
      await waitFor(() => expect(started).toHaveBeenCalledOnce());
      expect(screen.getByRole("group", { name: "Voice chat" })).toBeVisible();
      Recognition.last.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "Is it free?" }], { isFinal: true })] });
      fireEvent.click(await screen.findByRole("button", { name: "Done" }));
      await screen.findByText("Yes — it's free, so no tickets needed.", {}, SLOW);
      await waitFor(() => expect(utterances).toHaveLength(2));
      await new Promise((resolve) => setTimeout(resolve, 900));
      expect(started).toHaveBeenCalledOnce();
      act(() => utterances.at(-1)?.onend?.());
      await waitFor(() => expect(started).toHaveBeenCalledTimes(2), SLOW);
      expect(fetchImpl).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole("button", { name: "End voice chat" }));
      expect(screen.queryByRole("group", { name: "Voice chat" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Start voice chat with Fern" })).toBeVisible();
    } finally { vi.unstubAllGlobals(); }
  });
  it("answers the first message with cards and a natural reply", async () => {
    const fetchImpl = server();
    renderOverlay(fetchImpl);
    expect(screen.getByRole("dialog", { name: "Fern" })).toBeVisible();
    say("Something with the kids");
    expect(await screen.findByRole("article", { name: /Best match: Bundle Baby/ }, SLOW)).toBeVisible();
    expect(await screen.findByText("Want something outdoors too?", {}, SLOW)).toBeVisible();
    expect(screen.getByText("Bundle Baby", { selector: ".ask-rich strong" })).toBeVisible();
    expect(screen.getByText(/Looking at:/).closest("p")).toHaveTextContent("Looking at: With kidsEdit");
    expect(bodies(fetchImpl)[0]).toMatchObject({ text: "Something with the kids", previous: null, shown: [], history: [{ role: "assistant" }] });
    expect(screen.getByText("14 free searches left today")).toBeVisible();
  });

  it("keeps the cards in view while chatting about them, and sends what's on screen", async () => {
    const fetchImpl = server([searchEvents, chatOnly]);
    renderOverlay(fetchImpl);
    say("Something with the kids");
    await screen.findByText("Want something outdoors too?", {}, SLOW);
    say("Is it free?");
    expect(await screen.findByText("Yes — it's free, so no tickets needed.", {}, SLOW)).toBeVisible();
    expect(screen.getByRole("article", { name: /Best match: Bundle Baby/ })).toBeVisible();
    expect(bodies(fetchImpl)[1]).toMatchObject({
      text: "Is it free?", previous: { kids: true },
      shown: [{ title: "Bundle Baby", venue: "Aotea Centre", price: "Free" }],
      history: expect.arrayContaining([{ role: "user", text: "Something with the kids" }, { role: "assistant", text: expect.stringContaining("Bundle Baby") }]),
    });
  });

  it("folds earlier cards once a new search brings its own, in the layout the assistant chose", async () => {
    const tonight: AskStreamEvent[] = [
      { type: "understood", filters: { ...EMPTY_FILTERS, dates: ["2026-10-01"] }, chips: [{ key: "dates", label: "Thu 1 Oct" }] },
      { type: "result", card: card("b", "Late Jazz", "2026-10-01T21:00:00+13:00") }, { type: "result", card: card("c", "Early Comedy", "2026-10-01T18:00:00+13:00") },
      { type: "layout", layout: "timeline" }, { type: "reply", delta: "Here's your evening." }, { type: "done", remaining: 13, tier: "guest" },
    ];
    renderOverlay(server([searchEvents, tonight]));
    say("Something with the kids");
    await screen.findByText("Want something outdoors too?", {}, SLOW);
    say("Actually, plans for tonight");
    await screen.findByText("Here's your evening.", {}, SLOW);
    expect(screen.getByText("Earlier · 1 result · With kids")).toBeVisible();
    const times = [...document.querySelectorAll(".ask-timeline li article")].map((article) => article.getAttribute("aria-label"));
    expect(times).toEqual(["Early Comedy", "Late Jazz"]);
  });

  it("edits the search from the filter line", async () => {
    const fetchImpl = server([searchEvents, searchEvents]);
    renderOverlay(fetchImpl);
    say("Something with the kids");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }, SLOW));
    fireEvent.click(screen.getByRole("button", { name: "Remove With kids" }));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2), SLOW);
    expect(bodies(fetchImpl)[1]).toMatchObject({ refineOnly: true, previous: { kids: false } });
  });

  it("marks loosened filters and labels the closest alternatives", async () => {
    renderOverlay(server([[
      { type: "understood", filters: { ...EMPTY_FILTERS, kids: true, area: "central" }, chips: [{ key: "area", label: "Central" }, { key: "kids", label: "With kids" }] },
      { type: "relaxed", keys: ["area"] }, ...searchEvents.slice(1),
    ]]));
    say("Kids stuff in the city");
    expect(await screen.findByText("No exact match — here are the closest.", {}, SLOW)).toBeVisible();
    expect(screen.getByText("Central (loosened)")).toBeInTheDocument();
  });

  it("starts a new chat with a fresh search", async () => {
    const fetchImpl = server([searchEvents, searchEvents]);
    renderOverlay(fetchImpl);
    say("Something with the kids");
    await screen.findByText("Want something outdoors too?", {}, SLOW);
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.getByText("Sure — what are you after this time?")).toBeVisible();
    say("A movie");
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2), SLOW);
    expect(bodies(fetchImpl)[1]).toMatchObject({ text: "A movie", previous: null });
  });

  it("switches assistant: the page re-themes, the new one introduces itself, and replies use its tone", async () => {
    const fetchImpl = server();
    renderOverlay(fetchImpl);
    fireEvent.click(screen.getByRole("button", { name: "Change assistant" }));
    fireEvent.click(screen.getByRole("radio", { name: /Sunny.*Inventor/ }));
    expect(document.documentElement.dataset.assistant).toBe("sunny");
    expect(screen.getByRole("dialog", { name: "Sunny" })).toBeVisible();
    expect(screen.getByText("Hi, I'm Sunny — I'll take it from here!")).toBeVisible();
    say("Something fun", "Sunny");
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled(), SLOW);
    expect(bodies(fetchImpl)[0]).toMatchObject({ assistant: "sunny" });
  });

  it("talks Chinese on the English site: the mic follows the visitor and Chinese replies get a Chinese voice", async () => {
    const heard: Array<{ lang: string }> = [];
    const spoken: Array<{ text: string; lang: string }> = [];
    class Recognition { lang = ""; interimResults = false; continuous = false; onresult = null; onerror = null; onend = null; start() { heard.push(this); } stop() {} abort() {} }
    class Utterance { lang = ""; voice = null; rate = 1; pitch = 1; onend: (() => void) | null = null; onerror = null; constructor(public text: string) {} }
    vi.stubGlobal("webkitSpeechRecognition", Recognition);
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("speechSynthesis", { getVoices: () => [], cancel: vi.fn(), speak: (utterance: Utterance) => { spoken.push(utterance); utterance.onend?.(); } });
    renderOverlay(server([[{ type: "reply", delta: "好的！这个周末有几个适合小朋友的活动。" }, { type: "done", remaining: 13, tier: "guest" }]]));
    expect(screen.getByRole("button", { name: "Voice input: English. Switch to Chinese" })).toHaveTextContent("EN");
    say("周末带小朋友去哪玩");
    expect(await screen.findByText("好的！这个周末有几个适合小朋友的活动。", {}, SLOW)).toBeVisible();
    await waitFor(() => expect(spoken.at(-1)).toMatchObject({ lang: "zh-CN" }), SLOW);
    expect(spoken[0]).toMatchObject({ lang: "en-NZ" });
    expect(screen.getByRole("button", { name: "Voice input: Chinese. Switch to English" })).toHaveTextContent("中");
    fireEvent.click(screen.getByRole("button", { name: "Start voice chat with Fern" }));
    await waitFor(() => expect(heard.at(-1)).toMatchObject({ lang: "zh-CN" }), SLOW);
    expect(localStorage.getItem("kiwicue.ask.voiceLanguage")).toBe("zh");
    vi.unstubAllGlobals();
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
    expect(screen.queryByRole("button", { name: "Start voice chat with Fern" })).not.toBeInTheDocument();
    expect(screen.getByText("Voice isn't supported in this browser. Type instead.")).toBeVisible();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("can be muted and remembers it", () => {
    renderOverlay(server());
    fireEvent.click(screen.getByRole("button", { name: "Mute Fern" }));
    expect(screen.getByRole("button", { name: "Unmute Fern" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("kiwicue.ask.muted")).toBe("1");
  });

  it("speaks Chinese", () => {
    localStorage.setItem("kiwicue-language", "zh");
    renderOverlay(server());
    expect(screen.getByText("嗨，我是 Fern！想在奥克兰找点什么好玩的？")).toBeVisible();
    expect(screen.getByRole("button", { name: "这个周末去哪玩" })).toBeVisible();
  });
});
