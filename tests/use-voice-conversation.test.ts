import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_QUIET_TURNS, RELISTEN_MS, useVoiceConversation } from "../components/ask/use-voice-conversation";

type Props = { listening: boolean; speaking: boolean; busy: boolean; active: boolean; error: "denied" | "failed" | null };
const idle: Props = { listening: false, speaking: false, busy: false, active: true, error: null };

function setUp() {
  const mic = { start: vi.fn(), cancel: vi.fn() };
  const silence = vi.fn();
  const hook = renderHook((props: Props) => useVoiceConversation({
    microphone: { listening: props.listening, error: props.error, start: mic.start, cancel: mic.cancel },
    speaking: props.speaking, busy: props.busy, active: props.active, silence,
  }), { initialProps: idle });
  return { ...hook, mic, silence };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useVoiceConversation", () => {
  it("listens again by itself once the assistant has answered and finished speaking", () => {
    const { result, rerender, mic } = setUp();
    act(() => result.current.start());
    expect(mic.start).toHaveBeenCalledTimes(1);
    rerender({ ...idle, listening: true });
    act(() => result.current.noteHeard());
    rerender({ ...idle, busy: true });
    rerender({ ...idle, speaking: true });
    act(() => vi.advanceTimersByTime(RELISTEN_MS * 3));
    expect(mic.start).toHaveBeenCalledTimes(1);
    rerender(idle);
    act(() => vi.advanceTimersByTime(RELISTEN_MS));
    expect(mic.start).toHaveBeenCalledTimes(2);
    expect(result.current.on).toBe(true);
  });

  it("does nothing until started, and stops when ended", () => {
    const { result, rerender, mic, silence } = setUp();
    act(() => vi.advanceTimersByTime(RELISTEN_MS * 3));
    expect(mic.start).not.toHaveBeenCalled();
    act(() => result.current.start());
    rerender({ ...idle, listening: true });
    act(() => result.current.end());
    expect(mic.cancel).toHaveBeenCalled();
    expect(silence).toHaveBeenCalled();
    rerender(idle);
    act(() => vi.advanceTimersByTime(RELISTEN_MS * 3));
    expect(mic.start).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ on: false, ended: null });
  });

  it("pauses after several quiet turns in a row", () => {
    const { result, rerender } = setUp();
    act(() => result.current.start());
    for (let turn = 0; turn < MAX_QUIET_TURNS; turn += 1) {
      rerender({ ...idle, listening: true });
      rerender(idle);
    }
    expect(result.current).toMatchObject({ on: false, ended: "quiet" });
  });

  it("stops when the mic is blocked or the panel is hidden", () => {
    const blocked = setUp();
    act(() => blocked.result.current.start());
    blocked.rerender({ ...idle, error: "denied" });
    expect(blocked.result.current).toMatchObject({ on: false, ended: "denied" });

    const hidden = setUp();
    act(() => hidden.result.current.start());
    hidden.rerender({ ...idle, active: false });
    expect(hidden.result.current.on).toBe(false);
  });
});
