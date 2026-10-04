import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SILENCE_MS, speechRecognitionConstructor, useSpeechInput } from "../components/ask/use-speech-input";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = ""; interimResults = false; continuous = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
}

// A continuous session reports every segment so far; each segment is final or still interim.
function results(...segments: Array<[string, boolean]>) {
  return { resultIndex: 0, results: segments.map(([transcript, isFinal]) => Object.assign([{ transcript }], { isFinal })) };
}

describe("speech input", () => {
  beforeEach(() => { (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition; });
  afterEach(() => { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; vi.useRealTimers(); });

  it("detects support", () => {
    expect(speechRecognitionConstructor({})).toBeNull();
    expect(speechRecognitionConstructor({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
  });

  it("keeps listening across pauses and sends the whole utterance once after silence", () => {
    vi.useFakeTimers();
    const onFinal = vi.fn();
    const { result: hook } = renderHook(() => useSpeechInput({ language: "zh", onFinal }));
    act(() => hook.current.start());
    expect(FakeRecognition.last).toMatchObject({ lang: "zh-CN", continuous: true, interimResults: true });
    act(() => FakeRecognition.last?.onresult?.(results(["这周六", true], ["带孩子", false])));
    expect(hook.current.interim).toBe("这周六带孩子");
    act(() => { vi.advanceTimersByTime(SILENCE_MS - 500); });
    act(() => FakeRecognition.last?.onresult?.(results(["这周六", true], ["带孩子去东区", true])));
    expect(onFinal).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(SILENCE_MS); });
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("这周六带孩子去东区");
    expect(hook.current.listening).toBe(false);
  });

  it("sends what it heard straight away when the mic is tapped again", () => {
    const onFinal = vi.fn();
    const { result: hook } = renderHook(() => useSpeechInput({ language: "en", onFinal }));
    act(() => hook.current.start());
    act(() => FakeRecognition.last?.onresult?.(results(["something fun this weekend", false])));
    act(() => hook.current.stop());
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("something fun this weekend");
  });

  it("reports a denied microphone", () => {
    const { result: hook } = renderHook(() => useSpeechInput({ language: "en", onFinal: vi.fn() }));
    act(() => hook.current.start());
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(hook.current.error).toBe("denied");
  });

  it("discards results arriving after cancellation instead of sending speaker audio", () => {
    vi.useFakeTimers();
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ language: "en", onFinal }));
    act(() => result.current.start());
    const old = FakeRecognition.last!;
    act(() => old.onresult?.(results(["assistant playback", true])));
    act(() => result.current.cancel());
    act(() => { old.onresult?.(results(["late playback", true])); old.onend?.(); vi.advanceTimersByTime(SILENCE_MS); });
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.interim).toBe("");
    expect(result.current.listening).toBe(false);
  });

  it("ignores an older session's results, errors and end while the new turn listens", () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechInput({ language: "en", onFinal }));
    act(() => result.current.start());
    const old = FakeRecognition.last!;
    act(() => result.current.start());
    act(() => { old.onresult?.(results(["old audio", true])); old.onerror?.({ error: "not-allowed" }); old.onend?.(); });
    expect(result.current.listening).toBe(true);
    expect(result.current.error).toBeNull();
    expect(onFinal).not.toHaveBeenCalled();
    act(() => FakeRecognition.last?.onresult?.(results(["my new question", true])));
    act(() => result.current.stop());
    expect(onFinal).toHaveBeenCalledWith("my new question");
  });
});
