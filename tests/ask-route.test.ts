import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConverseModel, SearchInput } from "../lib/ask/converse";
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
const search: SearchInput = { query: "family things on Saturday", fresh: true, dates: ["2026-10-03"], names: [], place: null, maxPrice: null, layout: "spotlight" };

type Execute = (input: SearchInput, options: { toolCallId: string; messages: [] }) => Promise<unknown>;
/** A stand-in for DeepSeek: optionally calls the search tool, then streams `reply`. */
function model(calls: SearchInput[], reply: string[], seen: unknown[] = []): ConverseModel {
  return vi.fn<ConverseModel>(({ tools }) => {
    const execute = (tools.search as unknown as { execute: Execute }).execute;
    const run = (async () => { for (const call of calls) seen.push(await execute(call, { toolCallId: "t", messages: [] })); })();
    return {
      textStream: (async function* () { await run; for (const delta of reply) yield delta; })(),
      usage: run.then(() => ({ inputTokens: 2_000, outputTokens: 100 })),
    };
  });
}

function deps(overrides: Partial<AskDeps> = {}): AskDeps {
  return {
    configured: true,
    quota: { reserve: vi.fn(async () => ({ allowed: true as const, usageId: "u1", remaining: 4, degrade: false, tier: "guest" as const })), recordCost: vi.fn(async () => undefined) },
    identify: vi.fn(async () => ({ subject: "ip:hash", tier: "guest" as const, userId: null })),
    evaluate: vi.fn<Evaluate>(async ({ questions }) => ({
      inputTokens: 500,
      answers: ("domain" in questions ? { domain: { type: "choice", choice: "events", probabilities: { events: 0.9 } } } : { c0: { type: "score", score: 3 } }) as Record<string, JevAnswer>,
    })),
    converse: model([search], ["Bundle Baby ", "looks perfect."]),
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

const ask = { text: "Anything for the kids on Saturday?", language: "en", previous: null, history: [{ role: "user", text: "hi" }, { role: "assistant", text: "Hey!" }], assistant: "sunny" };

afterEach(() => vi.restoreAllMocks());

describe("POST /api/ask", () => {
  it("lets the assistant search, streams the cards, then its own reply, and records the cost", async () => {
    const seen: unknown[] = [];
    const d = deps({ converse: model([search], ["Bundle Baby ", "looks perfect."], seen) });
    const response = await handleAsk(post(ask), d);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    const received = await events(response);
    expect(received.map((event) => event.type)).toEqual(["understood", "result", "best", "layout", "reply", "reply", "done"]);
    expect(received[0]).toMatchObject({ type: "understood", filters: { domain: "events", dates: ["2026-10-03"] } });
    expect(received[3]).toEqual({ type: "layout", layout: "spotlight" });
    expect(seen[0]).toMatchObject({ found: 1, options: [{ n: 1, title: "Bundle Baby", when: "Sat, 3 Oct, 10:00 am", venue: "Aotea Centre" }] });

    const call = vi.mocked(d.converse).mock.calls[0][0];
    expect(call.system).toContain("You are Sunny");
    expect(call.messages).toEqual([{ role: "user", content: "hi" }, { role: "assistant", content: "Hey!" }, { role: "user", content: "Anything for the kids on Saturday?" }]);
    // Jev 500 + 500 input (understand, rank), DeepSeek 2000 input and 100 output.
    expect(d.quota!.recordCost).toHaveBeenCalledWith("u1", expect.any(Number), false);
    expect(vi.mocked(d.quota!.recordCost).mock.calls[0][1]).toBeGreaterThan(0);
  });

  it("just talks when no search is needed", async () => {
    const d = deps({ converse: model([], ["You're welcome!"]) });
    const received = await events(await handleAsk(post({ ...ask, text: "thanks!" }), d));
    expect(received.map((event) => event.type)).toEqual(["reply", "done"]);
    expect(d.evaluate).not.toHaveBeenCalled();
  });

  it("lets a second search refine the first, and refuses a third", async () => {
    const seen: unknown[] = [];
    const evaluate = vi.fn<Evaluate>(async ({ questions }) => ({
      inputTokens: 1,
      answers: ("kids" in questions ? { kids: { type: "choice", choice: "on", probabilities: { on: 0.9 } } } : {}) as Record<string, JevAnswer>,
    }));
    const d = deps({ evaluate, converse: model([search, { ...search, query: "with kids", fresh: false }, search], ["ok"], seen) });
    const received = await events(await handleAsk(post(ask), d));
    const understood = received.filter((event) => event.type === "understood");
    expect(understood).toHaveLength(2);
    expect(understood[1]).toMatchObject({ filters: { kids: true, dates: ["2026-10-03"] } });
    expect(seen[2]).toEqual({ error: expect.stringContaining("Already searched") });
  });

  it("falls back to a plain search when the assistant fails before saying anything", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const broken = vi.fn<ConverseModel>(() => ({ textStream: (async function* () { throw new Error("ds down"); })(), usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }) }));
    const received = await events(await handleAsk(post(ask), deps({ converse: broken })));
    expect(received.map((event) => event.type)).toEqual(["notice", "understood", "result", "best", "done"]);
  });

  it("streams pictures and trailers after the results without holding them up", async () => {
    const media = vi.fn(async () => [{ id: "a", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" }]);
    const received = await events(await handleAsk(post(ask), deps({ media })));
    expect(media).toHaveBeenCalledWith({ cards: [expect.objectContaining({ id: "a" })], bestId: "a", language: "en" });
    expect(received.find((event) => event.type === "media")).toEqual({ type: "media", id: "a", imageUrl: "https://image.tmdb.org/t/p/w500/a.jpg", trailerKey: "dQw4w9WgXcQ" });
    expect(received.at(-1)?.type).toBe("done");
  });

  it("drops media that fails validation or throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bad = deps({ media: vi.fn(async () => [{ id: "a", imageUrl: "https://evil.example/a.jpg", trailerKey: null }]) });
    expect((await events(await handleAsk(post(ask), bad))).map((event) => event.type)).not.toContain("media");
    const failing = deps({ media: vi.fn(async () => { throw new Error("tmdb"); }) });
    expect((await events(await handleAsk(post(ask), failing))).at(-1)).toMatchObject({ type: "done" });
  });

  it("skips DeepSeek when the budget is nearly spent", async () => {
    const d = deps({ quota: { reserve: vi.fn(async () => ({ allowed: true as const, usageId: "u1", remaining: 3, degrade: true, tier: "guest" as const })), recordCost: vi.fn(async () => undefined) } });
    const received = await events(await handleAsk(post(ask), d));
    expect(d.converse).not.toHaveBeenCalled();
    expect(received.map((event) => event.type)).toEqual(["notice", "understood", "result", "best", "done"]);
  });

  it("uses the given filters without understanding or chatting for chip refinements", async () => {
    const d = deps();
    const previous = { domain: "events", dates: [], timeOfDay: "any", area: "any", category: "any", kids: false, free: false, names: [], place: null, maxPrice: null };
    const received = await events(await handleAsk(post({ ...ask, previous, refineOnly: true }), d));
    expect(d.converse).not.toHaveBeenCalled();
    expect(received[0]).toMatchObject({ type: "understood", filters: previous });
  });

  it.each([
    ["quota_exhausted", 429], ["rate_limited", 429], ["budget_exhausted", 429], ["unavailable", 503],
  ] as const)("returns an error event when quota says %s", async (reason, status) => {
    const d = deps({ quota: { reserve: vi.fn(async () => ({ allowed: false as const, reason, remaining: 0, tier: "guest" as const })), recordCost: vi.fn() } });
    const response = await handleAsk(post(ask), d);
    expect(response.status).toBe(status);
    expect((await events(response))[0]).toMatchObject({ type: "error", code: reason });
    expect(d.converse).not.toHaveBeenCalled();
  });

  it("rejects invalid input and an unconfigured service before spending anything", async () => {
    const d = deps();
    expect((await handleAsk(post({ text: "" }), d)).status).toBe(400);
    expect((await handleAsk(new Request("https://kiwicue.nz/api/ask", { method: "POST", body: "x".repeat(40_000) }), d)).status).toBe(413);
    expect((await handleAsk(post(ask), deps({ configured: false }))).status).toBe(503);
    expect(d.quota!.reserve).not.toHaveBeenCalled();
  });
});
