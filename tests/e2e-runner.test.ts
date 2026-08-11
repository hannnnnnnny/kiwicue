import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../scripts/run-e2e.mjs"), "utf8");

describe("E2E runner safety", () => {
  it("observes the spawned server and preserves external base URL support", () => {
    expect(source).toMatch(/waitForServer\(server/);
    expect(source).toContain("server.exitCode");
    expect(source).toContain("process.env.E2E_BASE_URL");
  });
});
