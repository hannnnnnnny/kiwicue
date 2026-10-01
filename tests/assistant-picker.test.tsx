import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantPicker } from "../components/ask/assistant-picker";
import { ASSISTANTS } from "../lib/assistants";

afterEach(cleanup);

describe("AssistantPicker", () => {
  it("lists the five assistants as a radio group with the current one checked", () => {
    render(<AssistantPicker current={ASSISTANTS.fern} language="en" onPick={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: "Choose your assistant" });
    expect(group).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /Fern.*Guardian/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Sunny.*Inventor/ })).not.toBeChecked();
  });

  it("reports the pick and speaks Chinese", () => {
    const onPick = vi.fn();
    render(<AssistantPicker current={ASSISTANTS.fern} language="zh" onPick={onPick} />);
    expect(screen.getByRole("radiogroup", { name: "选择你的助手" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /Rua.*指挥官/ }));
    expect(onPick).toHaveBeenCalledWith("rua");
  });
});
