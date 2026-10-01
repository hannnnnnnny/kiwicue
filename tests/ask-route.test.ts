import { afterEach, describe, expect, it, vi } from "vitest";
import type { Evaluate, JevAnswer } from "../lib/ask/jev";
import { readEvents } from "../lib/ask/ndjson";
import { handleAsk, type AskDeps } from "../lib/ask/pipeline";
import type { AskStreamEvent } from "../lib/ask/schema";
import type { KiwiCueEvent } from "../lib/events";

const NOW = new Date("2026-09-30T23:00:00Z");
const show: KiwiCueEvent = {
  id: "a", name: "Bundle Baby", url: "https://www.ticketmaster.co.nz/x", imageUrl: null,
  start: { localDate: "2026-10-03", localTime: "10:00:00", dateTime: "2026-10-03T10:00:00+13:00", timezone: "Pacific/Auckland" },
  status: "onsale", category: "Miscellaneous", tags: ["Family"],
  venue: { id: "v", name: "Aotea Centre", city: "Auckland", address: null, postalCode: null, coordinates: null },
};

function deps(overrides: Partial<AskDeps> = {}): AskDeps {
  return {
    configured: true,
    quota: { reserve: vi.fn(async () => ({ allowed: true as const, usageId: "u1", remaining: 4, degrade: false, tier: "guest" as const })), recordCost: vi.fn(async () => undefined) },
    identify: vi.fn(async () => ({ subject: "ip:hash", tier: "guest" as const, userId: null })),
    evaluate: vi.fn<Evaluate>(async ({ questions }) => {
      const answers: Record<string, JevAnswer> = "domain" in questions
        ? { domain: { type: "choice", choice: "events", probabilities: { events: 0.9 } }, kids: { type: "choice", choice: "on", probabilities: { on: 0.9 } } }
        : { c0: { type: "score", score: 3 } };
      return { inputTokens: 500, answers };
    }),
    generateSlots: vi.fn(async () => ({ output: { names: [], place: null, dates: ["2026-10-03"], mode: "new" as const }, usage: { inputTokens: 300, outputTokens: 20 } })),
    streamReply: vi.fn(() => ({ textStream: (async function* () { yield "Bundle Baby "; yield "is perfect."; })(), usage: Promise.resolve({ inputTokens: 150, outputTokens: 10 }) })),
    sources: { events: vi.fn(async () => [show]), markets: vi.fn(() => []), movies: vi.fn(async () => []) },
    media: vi.fn(async () => []),
    now: () => NOW,
    ...overrides,
  };
}

async function events(response: Response): Promise<AskStreamEvent[]> {
  const received: AskStreamEvent[] = [];
  for await (const event of readEvents(response.body!)) received.push(event);
  return received;
}

function post(body: unknown): Request {
  return new Request("https://kiwicue.nz/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

const ask = { text: "周六带孩子去哪", language: "zh", previous: null, history: [] };

afterEach(() => vi.restoreAllMocks());

describe("POST /api/ask", () => {
  it("streams understanding, results, best match, reply and done, then records cost", async () => {
    const d = deps();
    const response = await handleAsk(post(ask), d);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    const received = await events(response);
    expect(received.map((event) => event.type)).toEqual(["understood", "result", "best", "reply", "reply", "done"]);
    expect(received[0]).toMatchObject({ type: "understood", filters: { domain: "events", kids: true, dates: ["2026-10-03"] } });
    expect(received[1]).toMatchObject({ type: "result", card: { id: "a", score: 1 } });
    expect(received.at(-1)).toEqual({ type: "done", remaining: 4, tier: "guest" });
    // Jev 500 + 500 input, DeepSeek 300 + 150 input and 20 + 10 output: 40 + 135 + 36 micro-USD.
    expect(d.quota!.recordCost).toHaveBeenCalledWith("u1", 211, false);
  });

  it("says which filters it loosened, before the results, and tells the reply about them", async () => {
    const evaluate = vi.fn<Evaluate>(async ({ questions }) => ({
      inputTokens: 500,
      answers: ("domain" in questions
        ? { domain: { type: "choice", choice: "events", probabilities: { events: 0.9 } }, area: { type: "choice", choice: "west", probabilities: { west: 0.9 } } }
        : { c0: { type: "score", score: 3 } }) as Record<string, JevAnswer>,
    }));
    const d = deps({ evaluate });
    const received = await events(await handleAsk(post({ ...ask, language: "en" }), d));
    expect(received.map((event) => event.type)).toEqual(["understood", "relaxed", "result", "best", "reply", "reply", "done"]);
    expect(received[1]).toEqual({ type: "relaxed", keys: ["area"] });
    const prompt = JSON.parse(vi.mocked(d.streamReply).mock.calls[0][0].prompt);
    expect(prompt.loosened).toEqual(["West"]);
  });

  it("streams pictures and trailers after the results without holding them up", async () => {
    const media = vi.fn(async () => [{ id: "a", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" }]);
    const d = deps({ media });
    const received = await events(await handleAsk(post(ask), d));
    const types = received.map((event) => event.type);
    expect(types.indexOf("media")).toBeGreaterThan(types.indexOf("best"));
    expect(types.at(-1)).toBe("done");
    expect(media).toHaveBeenCalledWith({ cards: [expect.objectContaining({ id: "a" })], bestId: "a", language: "zh" });
    expect(received.find((event) => event.type === "media")).toEqual({ type: "media", id: "a", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" });
  });

  it("drops media that fails validation or takes too long", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad = deps({ media: vi.fn(async () => [{ id: "a", imageUrl: "https://evil.example/a.jpg", trailerKey: null }]) });
    expect((await events(await handleAsk(post(ask), bad))).map((event) => event.type)).not.toContain("media");
    const failing = deps({ media: vi.fn(async () => { throw new Error("tmdb"); }) });
    expect((await events(await handleAsk(post(ask), failing))).at(-1)).toMatchObject({ type: "done" });
  });

  it("skips DeepSeek when the budget is nearly spent", async () => {
    const d = deps({ quota: { reserve: vi.fn(async () => ({ allowed: true as const, usageId: "u1", remaining: 3, degrade: true, tier: "guest" as const })), recordCost: vi.fn(async () => undefined) } });
    const received = await events(await handleAsk(post(ask), d));
    expect(d.generateSlots).not.toHaveBeenCalled();
    expect(d.streamReply).not.toHaveBeenCalled();
    expect(received.map((event) => event.type)).toContain("notice");
  });

  it("uses the given filters without understanding for chip refinements", async () => {
    const d = deps();
    const previous = { domain: "events", dates: [], timeOfDay: "any", area: "any", category: "any", kids: false, free: false, names: [], place: null };
    const received = await events(await handleAsk(post({ ...ask, previous, refineOnly: true }), d));
    expect(d.generateSlots).not.toHaveBeenCalled();
    expect(received[0]).toMatchObject({ type: "understood", filters: previous });
  });

  it.each([
    ["quota_exhausted", 429], ["rate_limited", 429], ["budget_exhausted", 429], ["unavailable", 503],
  ] as const)("returns an error event when quota says %s", async (reason, status) => {
    const d = deps({ quota: { reserve: vi.fn(async () => ({ allowed: false as const, reason, remaining: 0, tier: "guest" as const })), recordCost: vi.fn() } });
    const response = await handleAsk(post(ask), d);
    expect(response.status).toBe(status);
    expect((await events(response))[0]).toMatchObject({ type: "error", code: reason });
    expect(d.evaluate).not.toHaveBeenCalled();
  });

  it("rejects invalid input and an unconfigured service before spending anything", async () => {
    const d = deps();
    expect((await handleAsk(post({ text: "" }), d)).status).toBe(400);
    expect((await handleAsk(new Request("https://kiwicue.nz/api/ask", { method: "POST", body: "x".repeat(9000) }), d)).status).toBe(413);
    expect((await handleAsk(post(ask), deps({ configured: false }))).status).toBe(503);
    expect(d.quota!.reserve).not.toHaveBeenCalled();
  });

  it("still returns results when both AI providers fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({
      evaluate: vi.fn(async () => { throw new Error("jev down"); }),
      generateSlots: vi.fn(async () => { throw new Error("ds down"); }),
      streamReply: vi.fn(() => ({ textStream: (async function* () { throw new Error("ds down"); })(), usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }) })),
    });
    const received = await events(await handleAsk(post(ask), d));
    expect(received.map((event) => event.type)).toEqual(["understood", "notice", "result", "done"]);
  });
});
