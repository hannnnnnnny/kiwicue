import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { chatWindow, useAskChat, type ChatEntry } from "../components/ask/use-ask-chat";

function turn(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const asking = { reply: "Who's coming?", quickReplies: ["Kids", "Friends"], ready: false, summary: null, searchText: null, remaining: 5 };
const proposing = { reply: "Got it!", quickReplies: [], ready: true, summary: "Sat · kids · East", searchText: "Saturday with kids in east Auckland", remaining: 5 };

describe("chatWindow", () => {
  it("only sends the conversation since the last search", () => {
    const entries: ChatEntry[] = [
      { id: "g", role: "assistant", text: "Hi, I'm Kiwi!", quickReplies: [] },
      { id: "1", role: "user", text: "weekend" },
      { id: "r", role: "results", snapshot: null },
      { id: "2", role: "user", text: "cheaper please" },
    ];
    expect(chatWindow(entries)).toEqual([{ role: "user", text: "cheaper please" }]);
    expect(chatWindow(entries.slice(0, 2))).toEqual([{ role: "assistant", text: "Hi, I'm Kiwi!" }, { role: "user", text: "weekend" }]);
  });
});

describe("useAskChat", () => {
  it("greets, sends the thread, shows Kiwi's question and then a proposal", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(turn(asking)).mockResolvedValueOnce(turn(proposing));
    const search = vi.fn();
    const { result } = renderHook(() => useAskChat({ language: "en", fetchImpl, search }));
    expect(result.current.entries[0]).toMatchObject({ role: "assistant", text: expect.stringContaining("Kiwi") });

    await act(() => result.current.send("Something this weekend", "voice"));
    const body = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(fetchImpl.mock.calls[0][0]).toBe("/api/ask/chat");
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(["assistant", "user"]);
    expect(result.current.entries.at(-1)).toMatchObject({ role: "assistant", text: "Who's coming?", quickReplies: ["Kids", "Friends"] });
    expect(result.current.lastInput).toBe("voice");

    await act(() => result.current.send("Kids", "text"));
    expect(result.current.entries.slice(-2).map((entry) => entry.role)).toEqual(["assistant", "proposal"]);
    expect(result.current.remaining).toBe(5);

    act(() => result.current.confirm());
    expect(search).toHaveBeenCalledWith("Saturday with kids in east Auckland", ["Something this weekend", "Kids"]);
    expect(result.current.entries.at(-1)).toMatchObject({ role: "results" });
    expect(result.current.entries.find((entry) => entry.role === "proposal")).toMatchObject({ status: "confirmed" });
  });

  it("lets the visitor change the proposal and keep chatting", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(turn(proposing));
    const { result } = renderHook(() => useAskChat({ language: "zh", fetchImpl, search: vi.fn() }));
    await act(() => result.current.send("周六带孩子", "text"));
    act(() => result.current.change());
    expect(result.current.entries.find((entry) => entry.role === "proposal")).toMatchObject({ status: "changed" });
    expect(result.current.entries.at(-1)).toMatchObject({ role: "assistant", text: expect.stringContaining("改") });
  });

  it("shows service errors and network failures as a Kiwi error", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(turn({ error: { code: "budget_exhausted", message: "Resting today." } }, 429))
      .mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useAskChat({ language: "en", fetchImpl, search: vi.fn() }));
    await act(() => result.current.send("hi", "text"));
    expect(result.current.error).toEqual({ code: "budget_exhausted", message: "Resting today." });
    await act(() => result.current.send("hi again", "text"));
    expect(result.current.error?.code).toBe("internal");
    expect(result.current.pending).toBe(false);
  });
});
