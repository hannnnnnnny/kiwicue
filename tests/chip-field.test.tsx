import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChipField } from "../components/chip-field";
import {
  addTag, customKey, filterKey, normalizeTagLabel, toggleFilter,
  type ActiveChip, type ChipOption,
} from "../lib/chip-field";

const options: ChipOption[] = [
  { id: "music", label: "Live music" },
  { id: "free", label: "Free" },
];

describe("chip-field state", () => {
  it("normalizes whitespace, strips invisible characters and caps length by code point", () => {
    expect(normalizeTagLabel("  late \n\t night  ")).toBe("late night");
    expect(normalizeTagLabel("ja​zz‮")).toBe("jazz");
    expect(normalizeTagLabel("🎷".repeat(40))).toBe("🎷".repeat(32));
    expect(normalizeTagLabel("   ")).toBe("");
  });

  it("toggles a preset on and off", () => {
    const on = toggleFilter([], options[0]);
    expect(on).toEqual([{ key: filterKey("music"), label: "Live music", kind: "filter" }]);
    expect(toggleFilter(on, options[0])).toEqual([]);
  });

  it("selects a preset when its name is typed instead of creating a duplicate tag", () => {
    const { active, result } = addTag([], "  live MUSIC ", options);
    expect(result.status).toBe("selected");
    expect(active).toEqual([{ key: filterKey("music"), label: "Live music", kind: "filter" }]);
  });

  it("rejects case-insensitive duplicates, empty input and tags past the limit", () => {
    const first = addTag([], "Ponsonby", options).active;
    expect(addTag(first, "PONSONBY", options).result).toEqual({ status: "duplicate", key: customKey("ponsonby") });
    expect(addTag(first, "  ", options).result.status).toBe("empty");
    expect(addTag(first, "Parnell", options, 1).result.status).toBe("limit");
  });
});

function Harness({ initial = [] as ActiveChip[] }) {
  const [value, setValue] = useState<readonly ActiveChip[]>(initial);
  return <ChipField title="Filters" options={options} value={value} onChange={setValue} />;
}

const badge = () => screen.getByRole("button", { name: /Filters/ }).querySelector(".chipfield-badge__value")?.textContent;
const tagList = () => document.querySelector(".chipfield__tags") as HTMLElement;
const input = () => screen.getByLabelText("Active");

describe("ChipField", () => {
  afterEach(cleanup);

  it("updates pressed state and the badge count as presets toggle", () => {
    render(<Harness />);
    const chip = screen.getByRole("button", { name: "Live music" });
    expect(badge()).toBe("0");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(badge()).toBe("1");
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(badge()).toBe("0");
  });

  it("creates a tag on Enter and warns on duplicates without clearing the draft", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "Ponsonby" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(within(tagList()).getByText("Ponsonby")).toBeInTheDocument();
    expect(input()).toHaveValue("");

    fireEvent.change(input(), { target: { value: "ponsonby" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(screen.getByText("Ponsonby is already active")).toBeInTheDocument();
    expect(input()).toHaveValue("ponsonby");
    expect(input()).toHaveAttribute("aria-invalid", "true");
  });

  it("ignores Enter while an IME composition is in progress", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "奥克兰" } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(within(tagList()).queryByText("奥克兰")).not.toBeInTheDocument();
  });

  it("removes the last tag on Backspace in an empty input and via the × button", async () => {
    render(<Harness initial={[
      { key: filterKey("free"), label: "Free", kind: "filter" },
      { key: customKey("parnell"), label: "Parnell", kind: "custom" },
    ]} />);
    fireEvent.keyDown(input(), { key: "Backspace" });
    await act(async () => {});
    expect(within(tagList()).queryByText("Parnell")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Free" }));
    await act(async () => {});
    expect(within(tagList()).queryByText("Free")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Free" })).toHaveAttribute("aria-pressed", "false");
    expect(badge()).toBe("0");
  });

  it("clears the draft on Escape", () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: "draft" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input()).toHaveValue("");
  });
});
