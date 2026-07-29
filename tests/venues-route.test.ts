import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleVenuesRequest } from "../app/api/venues/route";
import { TicketmasterClientError } from "../lib/ticketmaster";

describe("GET /api/venues", () => {
  it("returns a cached venue catalogue without credentials", async () => {
    const loadVenues = vi.fn().mockResolvedValue([{ id: "a", name: "Aotea Centre" }]);
    const response = await handleVenuesRequest(loadVenues);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    const body = await response.json();
    expect(body).toEqual({ venues: [{ id: "a", name: "Aotea Centre" }] });
    expect(JSON.stringify(body)).not.toContain("TICKETMASTER_API_KEY");
  });

  it("sanitizes known upstream failures and disables error caching", async () => {
    const loadVenues = vi.fn().mockRejectedValue(
      new TicketmasterClientError("UPSTREAM_BUSY", 503),
    );
    const response = await handleVenuesRequest(loadVenues);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "UPSTREAM_BUSY", message: "Venue data is busy. Please try again shortly." },
    });
  });

  it("hides unexpected server failures", async () => {
    const loadVenues = vi.fn().mockRejectedValue(new Error("private details"));
    const response = await handleVenuesRequest(loadVenues);
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await response.json())).not.toContain("private details");
  });
});
