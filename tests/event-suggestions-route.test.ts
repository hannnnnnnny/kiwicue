import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleEventSuggestionsRequest } from "../app/api/events/suggestions/route";
import { TicketmasterClientError } from "../lib/ticketmaster";

const projectRoot = resolve(import.meta.dirname, "..");
const laufey = {
  name: "Laufey - A Matter Of Time Tour",
  category: "Music",
  localDate: "2026-08-14",
  venueName: "Spark Arena",
};

describe("GET /api/events/suggestions", () => {
  it("is implemented as an App Router route", () => {
    expect(existsSync(resolve(projectRoot, "app/api/events/suggestions/route.ts"))).toBe(true);
  });

  it("passes one safe partial query and the active filters to the suggestion service", async () => {
    const loadSuggestions = vi.fn().mockResolvedValue([laufey]);
    const response = await handleEventSuggestionsRequest(
      new Request(
        "http://localhost/api/events/suggestions?q=%20lauf%20&window=30d&category=concerts&venue=spark-arena",
      ),
      loadSuggestions,
    );

    expect(loadSuggestions).toHaveBeenCalledWith({
      query: "lauf",
      limit: 6,
      window: "30d",
      category: "concerts",
      venueId: "spark-arena",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=60");
    expect(await response.json()).toEqual({ suggestions: [laufey] });
  });

  it.each([
    "q=l",
    "q=one&q=two",
    `q=${"a".repeat(101)}`,
    "q=bad%00query",
  ])("returns no suggestions without calling upstream for unsafe input: %s", async (query) => {
    const loadSuggestions = vi.fn();
    const response = await handleEventSuggestionsRequest(
      new Request(`http://localhost/api/events/suggestions?${query}`),
      loadSuggestions,
    );

    expect(loadSuggestions).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ suggestions: [] });
  });

  it("hides upstream details and prevents error caching", async () => {
    const loadSuggestions = vi.fn().mockRejectedValue(
      new TicketmasterClientError("UPSTREAM_BUSY", 503),
    );
    const response = await handleEventSuggestionsRequest(
      new Request("http://localhost/api/events/suggestions?q=lauf"),
      loadSuggestions,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "UPSTREAM_BUSY",
        message: "Event suggestions are busy. Please try again shortly.",
      },
    });
  });
});
