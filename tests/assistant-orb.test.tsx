import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantOrb } from "../components/ask/assistant-orb";
import { ASSISTANTS } from "../lib/assistants";

const mountOrb = vi.fn();
vi.mock("../components/ask/orb-scene", () => ({ mountOrb: (...args: unknown[]) => mountOrb(...args) }));

function motion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); mountOrb.mockReset(); });

describe("AssistantOrb", () => {
  it("shows the poster in the small size and never loads 3D there", () => {
    motion(false);
    const { container } = render(<AssistantOrb assistant={ASSISTANTS.sunny} state="idle" size="small" />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/assistants/sunny.webp");
    expect(container.querySelector("canvas")).toBeNull();
    expect(mountOrb).not.toHaveBeenCalled();
  });

  it("loads the 3D model, passes state changes on, and cleans up", async () => {
    motion(false);
    const scene = { setState: vi.fn(), setMood: vi.fn(), dispose: vi.fn() };
    mountOrb.mockResolvedValue(scene);
    const { container, rerender, unmount } = render(<AssistantOrb assistant={ASSISTANTS.kai} state="idle" />);
    await waitFor(() => expect(container.querySelector(".ask-orb")).toHaveAttribute("data-ready", "true"));
    expect(mountOrb).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), "/assistants/kai.glb");
    rerender(<AssistantOrb assistant={ASSISTANTS.kai} state="thinking" />);
    expect(scene.setState).toHaveBeenLastCalledWith("thinking");
    rerender(<AssistantOrb assistant={ASSISTANTS.kai} state="speaking" mood="happy" />);
    expect(scene.setMood).toHaveBeenLastCalledWith("happy");
    expect(container.querySelector(".ask-orb")).toHaveAttribute("data-mood", "happy");
    rerender(<AssistantOrb assistant={ASSISTANTS.kai} state="thinking" />);
    expect(container.querySelector(".ask-orb")).toHaveAttribute("data-state", "thinking");
    unmount();
    expect(scene.dispose).toHaveBeenCalled();
  });

  it("keeps the poster with reduced motion or when 3D fails", async () => {
    motion(true);
    const reduced = render(<AssistantOrb assistant={ASSISTANTS.iris} state="idle" />);
    expect(mountOrb).not.toHaveBeenCalled();
    expect(reduced.container.querySelector("img")).toHaveAttribute("src", "/assistants/iris.webp");
    reduced.unmount();

    motion(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mountOrb.mockRejectedValue(new Error("no webgl"));
    const failed = render(<AssistantOrb assistant={ASSISTANTS.iris} state="idle" />);
    await waitFor(() => expect(mountOrb).toHaveBeenCalled());
    expect(failed.container.querySelector(".ask-orb")).not.toHaveAttribute("data-ready");
    expect(failed.container.querySelector("img")).toBeVisible();
  });
});
