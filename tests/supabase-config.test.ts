import { describe, expect, it } from "vitest";
import { readSupabasePublicConfig, supabaseConnectOrigin } from "../lib/supabase/config";

describe("Supabase configuration", () => {
  it("returns null when optional auth integration is not configured", () => {
    expect(readSupabasePublicConfig({})).toBeNull();
  });

  it("accepts only an HTTPS project URL and a publishable key", () => {
    expect(readSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    })).toEqual({ url: "https://example.supabase.co", key: "sb_publishable_example" });
    expect(readSupabasePublicConfig({
      NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    })).toBeNull();
  });

  it("adds only validated project origins to the CSP", () => {
    expect(supabaseConnectOrigin("https://example.supabase.co/")).toBe("https://example.supabase.co");
    expect(supabaseConnectOrigin("javascript:alert(1)")).toBeNull();
  });
});
