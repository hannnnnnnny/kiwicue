import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAssistant } from "../components/use-assistant";

afterEach(() => { localStorage.clear(); delete document.documentElement.dataset.assistant; });

describe("useAssistant", () => {
  it("starts with Fern, switches, re-themes the page and remembers the choice", () => {
    const first = renderHook(() => useAssistant());
    const second = renderHook(() => useAssistant());
    expect(first.result.current.assistant.id).toBe("fern");
    act(() => first.result.current.setAssistant("sunny"));
    expect(document.documentElement.dataset.assistant).toBe("sunny");
    expect(localStorage.getItem("kiwicue.assistant")).toBe("sunny");
    expect(second.result.current.assistant.name).toBe("Sunny");
  });

  it("ignores a tampered saved value", () => {
    localStorage.setItem("kiwicue.assistant", "javascript:alert(1)");
    expect(renderHook(() => useAssistant()).result.current.assistant.id).toBe("fern");
  });
});
