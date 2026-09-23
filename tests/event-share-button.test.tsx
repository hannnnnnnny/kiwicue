import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventShareButton } from "../components/event-share-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("event sharing", () => {
  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    render(<EventShareButton title="Harbour Lights" language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await vi.waitFor(() => expect(share).toHaveBeenCalledWith({
      title: "Harbour Lights",
      url: window.location.href,
    }));
  });

  it("copies the current page address and confirms the action in Chinese", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<EventShareButton title="海港之夜" language="zh" />);

    fireEvent.click(screen.getByRole("button", { name: "分享" }));
    expect(await screen.findByRole("status")).toHaveTextContent("链接已复制");
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("provides a useful recovery message if sharing is blocked", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    render(<EventShareButton title="Harbour Lights" language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Copy the browser address instead.");
  });
});
