import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventMap, buildOpenStreetMapUrls } from "../components/event-map";

const coordinates = { latitude: -36.8485, longitude: 174.7633 };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("event map", () => {
  it("builds HTTPS embed and larger-map URLs from validated coordinates", () => {
    const urls = buildOpenStreetMapUrls(coordinates);
    const embed = new URL(urls.embed);
    const larger = new URL(urls.larger);

    expect(embed.origin).toBe("https://www.openstreetmap.org");
    expect(embed.pathname).toBe("/export/embed.html");
    expect(embed.searchParams.get("layer")).toBe("mapnik");
    expect(embed.searchParams.get("marker")).toBe("-36.8485,174.7633");
    expect(embed.searchParams.get("bbox")?.split(",")).toHaveLength(4);
    expect(larger.origin).toBe("https://www.openstreetmap.org");
    expect(larger.searchParams.get("mlat")).toBe("-36.8485");
    expect(larger.searchParams.get("mlon")).toBe("174.7633");
    expect(larger.hash).toBe("#map=15/-36.8485/174.7633");
  });

  it("rejects an out-of-range marker", () => {
    expect(() => buildOpenStreetMapUrls({ latitude: 91, longitude: 0 })).toThrow(RangeError);
  });

  it("renders a labelled eager map, larger link, and attribution", () => {
    render(
      <EventMap
        coordinates={coordinates}
        language="en"
        venueName="The Civic"
      />,
    );

    const frame = screen.getByTitle("Map of The Civic");
    expect(frame).toHaveAttribute("loading", "eager");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("src", expect.stringContaining("openstreetmap.org/export/embed.html"));
    expect(screen.getByRole("link", { name: "Open larger map" })).toHaveAttribute(
      "href",
      expect.stringContaining("openstreetmap.org"),
    );
    expect(screen.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
  });

  it("uses Chinese map labels without changing the map source", () => {
    render(
      <EventMap
        coordinates={coordinates}
        language="zh"
        venueName="奥克兰市政厅"
      />,
    );

    expect(screen.getByTitle("奥克兰市政厅地图")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开大地图" })).toBeInTheDocument();
  });

  it("replaces a failed map frame with a localized recovery link", () => {
    render(
      <EventMap
        coordinates={coordinates}
        language="en"
        venueName="The Civic"
      />,
    );

    fireEvent.error(screen.getByTitle("Map of The Civic"));

    expect(screen.queryByTitle("Map of The Civic")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Map preview is temporarily unavailable");
    expect(screen.getByRole("link", { name: "Open venue in OpenStreetMap" })).toHaveAttribute(
      "href",
      expect.stringContaining("openstreetmap.org"),
    );
  });

  it("recovers when a map frame never finishes loading", () => {
    vi.useFakeTimers();
    render(
      <EventMap
        coordinates={coordinates}
        language="en"
        venueName="The Civic"
      />,
    );

    act(() => vi.advanceTimersByTime(8_000));

    expect(screen.queryByTitle("Map of The Civic")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Map preview is temporarily unavailable");
  });
});
