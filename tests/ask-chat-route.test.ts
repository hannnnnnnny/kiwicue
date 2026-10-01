import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerateTurn } from "../lib/ask/chat";
import { handleAskChat, type AskChatDeps } from "../lib/ask/chat-handler";
import type { QuotaDecision } from "../lib/ask/quota";

const NOW = new Date("2026-09-30T23:00:00Z");
const allowed: QuotaDecision = { allowed: true, usageId: "c1", remaining: 5, degrade: false, tier: "guest" };

function deps(overrides: Partial<AskChatDeps> = {}): AskChatDeps {
  return {
    configured: true,
    quota: { reserve: vi.fn(async () => allowed), recordCost: vi.fn(async () => undefined) },
    identify: vi.fn(async () => ({ subject: "ip:hash", tier: "guest" as const, userId: null })),
    generateTurn: vi.fn<GenerateTurn>(async () => ({
      output: { reply: "Who's coming?", quickReplies: ["Kids", "Friends"], ready: false, summary: null, searchText: null },
      usage: { inputTokens: 800, outputTokens: 50 },
    })),
    now: () => NOW,
    ...overrides,
  };
}

function post(body: unknown): Request {
  return new Request("https://kiwicue.nz/api/ask/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

const thread = { language: "en", messages: [{ role: "user", text: "Something this weekend" }] };

afterEach(() => vi.restoreAllMocks());

describe("POST /api/ask/chat", () => {
  it("returns Kiwi's turn, reserves a chat unit and records its cost", async () => {
    const d = deps();
    const response = await handleAskChat(post(thread), d);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ reply: "Who's coming?", quickReplies: ["Kids", "Friends"], ready: false, summary: null, searchText: null, remaining: 5 });
    expect(d.quota!.reserve).toHaveBeenCalledWith("ip:hash", "guest", null, "chat");
    // 800 × 0.30 + 50 × 1.20 micro-USD
    expect(d.quota!.recordCost).toHaveBeenCalledWith("c1", 300, false);
  });

  it("goes straight to the search proposal when the budget is nearly spent", async () => {
    const d = deps({ quota: { reserve: vi.fn(async () => ({ ...allowed, degrade: true })), recordCost: vi.fn(async () => undefined) } });
    const body = await (await handleAskChat(post(thread), d)).json();
    expect(d.generateTurn).not.toHaveBeenCalled();
    expect(body).toMatchObject({ ready: true, searchText: "Something this weekend" });
  });

  it("still lets the visitor search when their chat turns run out", async () => {
    const d = deps({ quota: { reserve: vi.fn(async (): Promise<QuotaDecision> => ({ allowed: false, reason: "quota_exhausted", remaining: 3, tier: "guest" })), recordCost: vi.fn() } });
    const response = await handleAskChat(post(thread), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ready: true, searchText: "Something this weekend", remaining: 3 });
    expect(d.generateTurn).not.toHaveBeenCalled();
  });

  it.each([["rate_limited", 429], ["budget_exhausted", 429], ["unavailable", 503]] as const)("returns an error when quota says %s", async (reason, status) => {
    const d = deps({ quota: { reserve: vi.fn(async (): Promise<QuotaDecision> => ({ allowed: false, reason, remaining: 0, tier: "guest" })), recordCost: vi.fn() } });
    const response = await handleAskChat(post(thread), d);
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(reason);
  });

  it("rejects invalid threads and an unconfigured service before spending anything", async () => {
    const d = deps();
    expect((await handleAskChat(post({ language: "en", messages: [] }), d)).status).toBe(400);
    expect((await handleAskChat(new Request("https://kiwicue.nz/api/ask/chat", { method: "POST", body: "x".repeat(9000) }), d)).status).toBe(413);
    expect((await handleAskChat(post(thread), deps({ configured: false }))).status).toBe(503);
    expect(d.quota!.reserve).not.toHaveBeenCalled();
  });
});
