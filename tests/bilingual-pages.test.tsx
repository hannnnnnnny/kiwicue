import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../app/page";
import EventsPage from "../app/events/page";
import { LanguageProvider } from "../components/language-provider";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bilingual route content", () => {
  it("switches the home page from English to the approved Chinese identity", () => {
    render(
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "Auckland events, before you miss them" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "在错过之前，发现奥克兰" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看奥克兰活动" })).toHaveAttribute("href", "/events");
    expect(screen.getByText("奥克兰首发")).toBeInTheDocument();
  });

  it("switches the event-page framing without changing the data request", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => undefined)));

    render(
      <LanguageProvider>
        <EventsPage />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "What’s on, before it’s gone" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换到中文" }));

    expect(screen.getByRole("heading", { name: "奥克兰有什么，别等错过才发现" })).toBeInTheDocument();
    expect(screen.getByText("奥克兰 · 未来 30 天")).toBeInTheDocument();
    expect(screen.getByText("最早发生优先")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
