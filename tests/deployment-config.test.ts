import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

describe("Vercel production deployment contract", () => {
  it("pins framework detection without a static output directory", () => {
    const configPath = resolve(projectRoot, "vercel.json");

    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      framework?: string;
      outputDirectory?: string;
    };

    expect(config.framework).toBe("nextjs");
    expect(config.outputDirectory).toBeUndefined();
  });

  it("keeps Vercel metadata local and documents the server-only secret", () => {
    const gitignore = readFileSync(resolve(projectRoot, ".gitignore"), "utf8");
    const readme = readFileSync(resolve(projectRoot, "README.md"), "utf8");

    expect(gitignore).toContain("/.vercel/");
    expect(readme).toContain("## Deployment");
    expect(readme).toContain("Sensitive");
    expect(readme).toContain("TICKETMASTER_API_KEY");
    expect(readme).toContain("vercel deploy --prod");
  });
});
