import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public activity privacy", () => {
  it("requires both a public profile and explicit preference before saved or Going data is visible", () => {
    const sql = readFileSync(resolve(import.meta.dirname, "../supabase/migrations/202609230004_public_activity.sql"), "utf8");
    expect(sql).toContain("p.is_public");
    expect(sql).toContain("settings.show_saved");
    expect(sql).toContain("settings.show_going");
    expect(sql).toContain("status in ('going', 'went')");
  });
});
