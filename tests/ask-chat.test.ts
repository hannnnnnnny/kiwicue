import { afterEach, describe, expect, it, vi } from "vitest";
import { chatTurn, type GenerateTurn } from "../lib/ask/chat";
import { askChatRequestSchema, type AskChatRequest } from "../lib/ask/chat-schema";

const today = "2026-10-01 (Thursday)";

function request(userTexts: string[], language: "en" | "zh" = "en"): AskChatRequest {
  const messages = userTexts.flatMap((text, index) => index === 0
    ? [{ role: "user" as const, text }]
    : [{ role: "assistant" as const, text: "Who is coming?" }, { role: "user" as const, text }]);
  return { language, messages };
}

afterEach(() => vi.restoreAllMocks());

describe("ask chat request schema", () => {
  it("accepts a thread that ends with the visitor", () => {
    expect(askChatRequestSchema.safeParse(request(["weekend plans"])).success).toBe(true);
  });

  it("rejects threads ending with Kiwi, too many visitor turns, or oversized text", () => {
    expect(askChatRequestSchema.safeParse({ language: "en", messages: [{ role: "assistant", text: "Hi" }] }).success).toBe(false);
    expect(askChatRequestSchema.safeParse(request(["1", "2", "3", "4", "5", "6", "7"])).success).toBe(false);
    expect(askChatRequestSchema.safeParse(request(["x".repeat(301)])).success).toBe(false);
    expect(askChatRequestSchema.safeParse({ ...request(["hi"]), extra: true }).success).toBe(false);
  });
});

describe("chatTurn", () => {
  it("returns Kiwi's question with quick replies and usage", async () => {
    const generate = vi.fn<GenerateTurn>().mockResolvedValue({
      output: { reply: "Fun! Who's coming along?", quickReplies: ["Kids", "Friends", "Just me"], ready: false, summary: null, searchText: null },
      usage: { inputTokens: 700, outputTokens: 40 },
    });
    const result = await chatTurn({ request: request(["Something this weekend"]), today, generate });
    expect(result).toEqual({
      turn: { reply: "Fun! Who's coming along?", quickReplies: ["Kids", "Friends", "Just me"], ready: false, summary: null, searchText: null },
      usage: { inputTokens: 700, outputTokens: 40 }, degraded: false,
    });
    expect(generate.mock.calls[0][0].system).toContain("Kiwi");
    expect(generate.mock.calls[0][0].system).toContain(today);
    expect(generate.mock.calls[0][0].prompt).toContain("Something this weekend");
  });

  it("trims long model output to the display limits", async () => {
    const asking = vi.fn<GenerateTurn>().mockResolvedValue({
      output: { reply: "a".repeat(260), quickReplies: ["1", "2", "3", "4", "5", "b".repeat(40)], ready: false, summary: null, searchText: null },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const question = (await chatTurn({ request: request(["hi"]), today, generate: asking })).turn;
    expect(question.reply).toHaveLength(200);
    expect(question.quickReplies).toEqual(["1", "2", "3", "4"]);

    const proposing = vi.fn<GenerateTurn>().mockResolvedValue({
      output: { reply: "Ready!", quickReplies: ["Yes"], ready: true, summary: "s".repeat(200), searchText: "q".repeat(400) },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const proposal = (await chatTurn({ request: request(["hi"]), today, generate: proposing })).turn;
    expect(proposal.quickReplies).toEqual([]);
    expect(proposal.summary).toHaveLength(120);
    expect(proposal.searchText).toHaveLength(300);
  });

  it("forces a search proposal on the sixth visitor turn", async () => {
    const generate = vi.fn<GenerateTurn>().mockResolvedValue({
      output: { reply: "And what budget?", quickReplies: ["Free"], ready: false, summary: null, searchText: null },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const { turn } = await chatTurn({ request: request(["weekend", "kids", "east", "morning", "cheap", "outdoors"]), today, generate });
    expect(turn.ready).toBe(true);
    expect(turn.quickReplies).toEqual([]);
    expect(turn.searchText).toBe("weekend kids east morning cheap outdoors");
    expect(generate.mock.calls[0][0].system).toContain("last turn");
  });

  it("skips DeepSeek and proposes the search when the budget is nearly spent", async () => {
    const generate = vi.fn<GenerateTurn>();
    const result = await chatTurn({ request: request(["周末带孩子"], "zh"), today, generate, forceReady: true });
    expect(generate).not.toHaveBeenCalled();
    expect(result.turn).toMatchObject({ ready: true, searchText: "周末带孩子", summary: "周末带孩子" });
    expect(result.turn.reply).toMatch(/找/u);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("falls back to searching with what it has when DeepSeek fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const generate = vi.fn<GenerateTurn>().mockRejectedValue(new Error("down"));
    const result = await chatTurn({ request: request(["live music tonight"]), today, generate });
    expect(result.degraded).toBe(true);
    expect(result.turn).toMatchObject({ ready: true, searchText: "live music tonight" });
  });
});
