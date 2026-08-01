import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventMap, buildOpenStreetMapUrls } from "../components/event-map";

const coordinates = { latitude: -36.8485, longitude: 174.7633 };

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

  it("renders a labelled lazy map, larger link, and attribution", () => {
    render(
      <EventMap
        coordinates={coordinates}
        language="en"
        venueName="The Civic"
      />,
    );

    const frame = screen.getByTitle("Map of The Civic");
    expect(frame).toHaveAttribute("loading", "lazy");
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
});
