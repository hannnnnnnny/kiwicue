import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AskResultCard } from "../components/ask/ask-result-card";
import type { AskCard } from "../lib/ask/schema";

const event: AskCard = { kind: "event", id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: "https://s1.ticketm.net/a.jpg", priceText: "Free", sessionCount: 1, score: 1 };
const movie: AskCard = { ...event, kind: "movie", id: "m", title: "Zootopia 2", href: "/movies?q=Zootopia%202", imageUrl: "https://image.tmdb.org/t/p/w500/z.jpg", trailerKey: "dQw4w9WgXcQ" };

function preferences({ reducedMotion = false, saveData = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") && reducedMotion, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("navigator", { ...navigator, connection: { saveData } });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AskResultCard", () => {
  it("leads the best event with a large picture", () => {
    const { container } = render(<AskResultCard card={event} best language="en" />);
    expect(container.querySelector(".ask-card-hero img")).toHaveAttribute("src", event.imageUrl);
    expect(screen.getByRole("link", { name: /Bundle Baby/ })).toHaveAttribute("href", "/events/a");
  });

  it("gives other cards a thumbnail, or a placeholder without a picture", () => {
    const { container, rerender } = render(<AskResultCard card={event} best={false} language="en" />);
    expect(container.querySelector(".ask-card-thumb img")).toHaveAttribute("src", event.imageUrl);
    expect(container.querySelector(".ask-card-hero")).toBeNull();
    rerender(<AskResultCard card={{ ...event, imageUrl: null }} best={false} language="en" />);
    expect(container.querySelector(".ask-card-thumb-empty")).toBeInTheDocument();
  });

  it("autoplays the best movie's trailer muted, and turns the sound on while silencing Kiwi", () => {
    preferences();
    const onSound = vi.fn();
    render(<AskResultCard card={movie} best language="en" onSound={onSound} />);
    const frame = screen.getByTitle("Zootopia 2 trailer");
    expect(frame.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*autoplay=1.*mute=1/u);
    expect(frame).toHaveAttribute("allow", expect.stringContaining("autoplay"));
    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
    expect(screen.getByTitle("Zootopia 2 trailer").getAttribute("src")).toContain("mute=0");
    expect(onSound).toHaveBeenCalled();
  });

  it.each([{ reducedMotion: true }, { saveData: true }])("shows the poster with a play button instead of autoplaying (%o)", (setting) => {
    preferences(setting);
    render(<AskResultCard card={movie} best language="zh" />);
    expect(screen.queryByTitle("Zootopia 2 预告片")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "播放预告片" }));
    expect(screen.getByTitle("Zootopia 2 预告片").getAttribute("src")).toContain("mute=0");
  });

  it("ignores a malformed trailer key", () => {
    preferences();
    const { container } = render(<AskResultCard card={{ ...movie, trailerKey: "bad key<>" }} best language="en" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".ask-card-hero img")).toHaveAttribute("src", movie.imageUrl);
  });
});
