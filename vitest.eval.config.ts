import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Evals call real models, so they never run with the unit tests: `npm run eval:replies`.
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 900_000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
