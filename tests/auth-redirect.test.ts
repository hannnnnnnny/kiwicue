import { describe, expect, it } from "vitest";
import { safeNextPath } from "../lib/auth/safe-next-path";

describe("post-auth navigation", () => {
  it("allows only local paths", () => {
    expect(safeNextPath("/saved?from=login")).toBe("/saved?from=login");
    expect(safeNextPath("https://evil.example/steal")).toBe("/events");
    expect(safeNextPath("//evil.example")).toBe("/events");
    expect(safeNextPath("/\\evil.example")).toBe("/events");
  });
});
