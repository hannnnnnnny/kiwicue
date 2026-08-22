import { describe, expect, it } from "vitest";
import { securityHeaders } from "../next.config";

describe("application security headers", () => {
  it("restricts framing, MIME sniffing, referrers, and sensitive browser capabilities", () => {
    const headers = new Map(securityHeaders.map(({ key, value }) => [key.toLowerCase(), value]));

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("permissions-policy")).toContain("geolocation=(self)");
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("content-security-policy")).toContain("object-src 'none'");
    expect(headers.get("content-security-policy")).toContain("https://www.youtube-nocookie.com");
    expect(headers.get("content-security-policy")).not.toContain("api_key");
  });
});
