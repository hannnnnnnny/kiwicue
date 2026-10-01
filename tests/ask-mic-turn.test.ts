import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MIC_COOLDOWN_MS, useMicTurn } from "../components/ask/use-mic-turn";

function setup(active = true) {
  const speech = { supported: true, listening: false, interim: "", error: null, start: vi.fn(), stop: vi.fn(), cancel: vi.fn() };
  const silence = vi.fn();
  const hook = renderHook(({ active }) => useMicTurn(speech, silence, active), { initialProps: { active } });
  return { ...hook, speech, silence };
}
afterEach(() => vi.useRealTimers());

it("silences playback immediately and delays microphone capture until residual audio fades", () => {
  vi.useFakeTimers();
  const { result, speech, silence } = setup();
  act(() => result.current.start());
  expect(silence).toHaveBeenCalledOnce();
  expect(speech.start).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(MIC_COOLDOWN_MS));
  expect(speech.start).toHaveBeenCalledOnce();
});

it("cancels a pending microphone start when playback or navigation interrupts it", () => {
  vi.useFakeTimers();
  const { result, speech, rerender } = setup();
  act(() => result.current.start());
  act(() => result.current.cancel());
  act(() => vi.advanceTimersByTime(MIC_COOLDOWN_MS));
  expect(speech.start).not.toHaveBeenCalled();
  act(() => result.current.start());
  rerender({ active: false });
  act(() => vi.advanceTimersByTime(MIC_COOLDOWN_MS));
  expect(speech.start).not.toHaveBeenCalled();
});

it("repeated taps never create concurrent microphone sessions", () => {
  vi.useFakeTimers();
  const { result, speech } = setup();
  act(() => { result.current.start(); result.current.start(); });
  act(() => vi.advanceTimersByTime(MIC_COOLDOWN_MS));
  expect(speech.start).toHaveBeenCalledOnce();
});
