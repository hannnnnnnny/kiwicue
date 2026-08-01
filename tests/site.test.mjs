import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pathFor = (name) => join(root, name);
const read = (name) => readFileSync(pathFor(name), "utf8");

test("publishes the complete static landing-page asset set", () => {
  for (const file of ["index.html", "styles.css", "language.mjs", ".nojekyll"]) {
    assert.ok(existsSync(pathFor(file)), `${file} must exist`);
  }
});

test("serves truthful bilingual Company Site content with English as default", () => {
  const html = read("index.html");

  assert.match(html, /<html lang="en">/);
  assert.match(html, /KiwiCue — Auckland events before you miss them/);
  assert.match(html, /Find Auckland before you miss it\./);
  assert.match(html, /在错过之前，发现奥克兰。/);
  assert.match(html, /data-copy="en"/);
  assert.match(html, /data-copy="zh"[^>]*hidden/);
  assert.match(html, /data-language-toggle/);
  assert.match(html, /official organiser or ticketing provider/i);
  assert.match(html, /independent project based in Auckland/i);
});

test("does not add tracking, data collection, ticket sales, or generator metadata", () => {
  const source = ["index.html", "styles.css", "language.mjs"]
    .map((file) => read(file))
    .join("\n");

  assert.doesNotMatch(source, /<form|<input|analytics|gtag|facebook pixel/i);
  assert.doesNotMatch(source, /<meta[^>]+name=["']generator["']|data-source-tool/i);
  assert.match(source, /does not sell tickets|不销售门票/i);
});

test("supports accessible language switching and responsive display", () => {
  const script = read("language.mjs");
  const css = read("styles.css");

  assert.match(script, /document\.documentElement\.lang/);
  assert.match(script, /querySelectorAll\("\[data-copy\]"\)/);
  assert.match(script, /addEventListener\("click"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /--portal-brand:\s*#126b4b/i);
  assert.doesNotMatch(css, /--signal|--acid|#c8ff3d|#d8ff57/i);
  assert.match(read("index.html"), /<meta name="theme-color" content="#ffffff" \/>/i);
});
