import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EventLocalFacets } from "../components/event-local-facets";
import { LanguageProvider } from "../components/language-provider";
import { buildEventFacetOptions, type EventLocalFacet } from "../lib/event-facets";
import type { KiwiCueEvent } from "../lib/events";

function event(id: string, tags: string[]): KiwiCueEvent {
  return {
    id,
    name: id,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: { localDate: "2099-09-01", localTime: "09:00:00", dateTime: "2099-09-01T00:00:00Z", timezone: "Pacific/Auckland" },
    status: "onsale",
    category: "Music",
    tags,
    venue: null,
  };
}

afterEach(() => cleanup());

describe("loaded-result facet controls", () => {
  it("exposes only represented options and reports the selected refinement accessibly", () => {
    const options = buildEventFacetOptions([event("one", ["Jazz"]), event("two", ["Rock"])]);
    let selected: EventLocalFacet = "all";
    const view = render(
      <LanguageProvider>
        <EventLocalFacets options={options} value={selected} onChange={(next) => { selected = next; view.rerender(<LanguageProvider><EventLocalFacets options={options} value={selected} onChange={(value) => { selected = value; }} /></LanguageProvider>); }} />
      </LanguageProvider>,
    );

    expect(screen.getByRole("heading", { name: "Narrow what is already here" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jazz1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rock1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Comedy/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jazz1" }));
    expect(screen.getByRole("button", { name: "Jazz1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Reset refinement" })).toBeInTheDocument();
  });
});
