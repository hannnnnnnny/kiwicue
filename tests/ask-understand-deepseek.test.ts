import { afterEach, describe, expect, it, vi } from "vitest";
import { understandWithDeepSeek, type GenerateSlots } from "../lib/ask/understand-deepseek";

describe("understandWithDeepSeek", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns validated slots and token usage", async () => {
    const generate = vi.fn<GenerateSlots>().mockResolvedValue({
      output: { names: ["Bundle Baby"], place: "Botany", dates: ["2026-10-03"], mode: "new" },
      usage: { inputTokens: 400, outputTokens: 40 },
    });
    const result = await understandWithDeepSeek({ text: "Bundle Baby near Botany on Saturday", history: [], previous: null, today: "2026-10-01 (Thursday)", generate });
    expect(result).toEqual({ understanding: { names: ["Bundle Baby"], place: "Botany", dates: ["2026-10-03"], mode: "new" }, usage: { inputTokens: 400, outputTokens: 40 } });
    expect(generate.mock.calls[0][0].prompt).toContain("Bundle Baby near Botany on Saturday");
    expect(generate.mock.calls[0][0].system).toContain("2026-10-01");
  });

  it("gives up after the timeout and logs without the question text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const generate: GenerateSlots = ({ abortSignal }) => new Promise((_, reject) => {
      abortSignal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const result = await understandWithDeepSeek({ text: "private question", history: [], previous: null, today: "2026-10-01", generate, timeoutMs: 20 });
    expect(result).toBeNull();
    expect(String(spy.mock.calls[0][0])).toContain("\"step\":\"deepseek\"");
    expect(String(spy.mock.calls[0][0])).not.toContain("private question");
  });
});
