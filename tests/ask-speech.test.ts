import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { speechRecognitionConstructor, useSpeechInput } from "../components/ask/use-speech-input";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = ""; interimResults = false; continuous = true;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
}

function result(transcript: string, isFinal: boolean) {
  return { resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal })] };
}

describe("speech input", () => {
  afterEach(() => { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; });

  it("detects support", () => {
    expect(speechRecognitionConstructor({})).toBeNull();
    expect(speechRecognitionConstructor({ webkitSpeechRecognition: FakeRecognition })).toBe(FakeRecognition);
  });

  it("streams interim text and hands over the final transcript in the site language", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onFinal = vi.fn();
    const { result: hook } = renderHook(() => useSpeechInput({ language: "zh", onFinal }));
    expect(hook.current.supported).toBe(true);
    act(() => hook.current.start());
    expect(FakeRecognition.last?.lang).toBe("zh-CN");
    act(() => FakeRecognition.last?.onresult?.(result("周六带", false)));
    expect(hook.current.interim).toBe("周六带");
    act(() => FakeRecognition.last?.onresult?.(result("周六带孩子", true)));
    expect(onFinal).toHaveBeenCalledWith("周六带孩子");
    act(() => FakeRecognition.last?.onend?.());
    expect(hook.current.listening).toBe(false);
  });

  it("reports a denied microphone", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const { result: hook } = renderHook(() => useSpeechInput({ language: "en", onFinal: vi.fn() }));
    act(() => hook.current.start());
    act(() => FakeRecognition.last?.onerror?.({ error: "not-allowed" }));
    expect(hook.current.error).toBe("denied");
  });
});
