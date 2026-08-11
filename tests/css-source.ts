import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

export function readApplicationCss(): string {
  const stylesDirectory = resolve(projectRoot, "app/styles");
  const files = readdirSync(stylesDirectory)
    .filter((file) => file.endsWith(".css"))
    .sort();
  return [
    readFileSync(resolve(projectRoot, "app/globals.css"), "utf8"),
    ...files.map((file) => readFileSync(resolve(stylesDirectory, file), "utf8")),
  ].join("\n");
}
