import { describe, expect, it } from "vitest";
import { isTrustedOfficialBookingUrl } from "../lib/official-booking";

describe("official booking URL policy", () => {
  it("accepts HTTPS URLs on approved cinema and ticketing hosts only", () => {
    expect(isTrustedOfficialBookingUrl("https://academycinemas.co.nz/fight-club")).toBe(true);
    expect(isTrustedOfficialBookingUrl("https://tickets.veezi.com/session")).toBe(true);
    expect(isTrustedOfficialBookingUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedOfficialBookingUrl("https://lookalike-tickets.example/checkout")).toBe(false);
    expect(isTrustedOfficialBookingUrl("https://user:pass@academycinemas.co.nz/session")).toBe(false);
    expect(isTrustedOfficialBookingUrl("https://academycinemas.co.nz:8443/session")).toBe(false);
  });
});
