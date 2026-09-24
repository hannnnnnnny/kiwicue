import { describe, expect, it } from "vitest";
import { GET } from "../app/auth/confirmed/route";

describe("phone confirmation landing", () => {
  it("removes the one-time code from the destination URL", async () => {
    const response = GET(new Request("https://kiwicue.vercel.app/auth/confirmed?code=secret-code"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://kiwicue.vercel.app/auth/verified?status=confirmed");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not claim confirmation when Supabase supplies an error", () => {
    const response = GET(new Request("https://kiwicue.vercel.app/auth/confirmed?error=access_denied&error_description=expired"));
    expect(response.headers.get("location")).toBe("https://kiwicue.vercel.app/auth/verified?status=unknown");
  });
});
