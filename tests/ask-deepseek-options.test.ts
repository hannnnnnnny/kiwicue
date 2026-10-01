import { afterEach, describe, expect, it, vi } from "vitest";

const { streamText } = vi.hoisted(() => ({ streamText: vi.fn() }));
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), streamText }));

import { deepseekConverse } from "../lib/ask/converse";

afterEach(() => { vi.clearAllMocks(); });

describe("DeepSeek conversation", () => {
  it("turns thinking off, allows search-then-reply steps, and reports usage", async () => {
    streamText.mockReturnValue({ textStream: (async function* () { yield "Hi"; })(), usage: Promise.resolve({ inputTokens: 10, outputTokens: 3 }) });
    const turn = deepseekConverse({ system: "s", messages: [{ role: "user", content: "hi" }], tools: {}, abortSignal: new AbortController().signal });
    const options = streamText.mock.calls[0][0];
    expect(options.providerOptions).toEqual({ deepseek: { thinking: { type: "disabled" } } });
    expect(options.stopWhen).toBeDefined();
    expect(options.maxRetries).toBe(0);
    await expect(turn.usage).resolves.toEqual({ inputTokens: 10, outputTokens: 3 });
  });
});
