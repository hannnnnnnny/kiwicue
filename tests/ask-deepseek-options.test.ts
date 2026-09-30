import { afterEach, describe, expect, it, vi } from "vitest";

const { generateText, streamText } = vi.hoisted(() => ({ generateText: vi.fn(), streamText: vi.fn() }));
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText, streamText }));

import { deepseekStreamReply, replyDeltas } from "../lib/ask/reply";
import { deepseekGenerateSlots } from "../lib/ask/understand-deepseek";

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("DeepSeek calls", () => {
  it("turn thinking off so the short reply budget goes to the answer", async () => {
    generateText.mockResolvedValue({ output: { names: [], place: null, dates: [], mode: "new" }, usage: { inputTokens: 1, outputTokens: 1 } });
    streamText.mockReturnValue({ textStream: (async function* () { yield "Hi"; })(), usage: Promise.resolve({ inputTokens: 1, outputTokens: 1 }) });
    const signal = new AbortController().signal;
    await deepseekGenerateSlots({ system: "s", prompt: "p", abortSignal: signal });
    deepseekStreamReply({ system: "s", prompt: "p", abortSignal: signal });
    const disabled = { deepseek: { thinking: { type: "disabled" } } };
    expect(generateText.mock.calls[0][0].providerOptions).toEqual(disabled);
    expect(streamText.mock.calls[0][0].providerOptions).toEqual(disabled);
  });

  it("logs when a reply finishes without any text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const empty = () => ({ textStream: (async function* () { /* no text */ })(), usage: Promise.resolve({ inputTokens: 90, outputTokens: 120 }) });
    const generator = replyDeltas({ text: "x", language: "en", top: [{ kind: "event", id: "a", title: "A", when: "2026-10-03T10:00:00+13:00", venue: null, href: "/events/a", imageUrl: null, priceText: null, sessionCount: 1, score: 1 }], stream: empty });
    const step = await generator.next();
    expect(step).toEqual({ done: true, value: { inputTokens: 90, outputTokens: 120 } });
    expect(String(spy.mock.calls[0][0])).toContain("\"code\":\"empty_reply\"");
  });
});
