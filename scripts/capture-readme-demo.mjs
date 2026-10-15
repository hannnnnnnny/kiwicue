import { chromium } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Capture a fresh guest session so the recording never contains account data.
const origin = "https://kiwicue.nz";
const output = resolve("output/playwright");
await mkdir(output, { recursive: true });
const directory = await mkdtemp(resolve(output, "readme-frames-"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const frames = [];
const captureProduct = process.argv.includes("--product");
const question = "Concerts this weekend";
let frameNumber = 0;
let pointer = { x: 1100, y: 490, pressed: false };
let stage = "Discover Auckland";

async function paintPointer() {
  await page.evaluate((position) => {
    let cursor = document.getElementById("readme-demo-cursor");
    if (!cursor) {
      cursor = document.createElement("div");
      cursor.id = "readme-demo-cursor";
      cursor.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;width:38px;height:44px;filter:drop-shadow(0 2px 3px #0005)";
      cursor.innerHTML = '<svg width="38" height="44" viewBox="0 0 38 44" style="overflow:visible"><circle class="click-ring" cx="8" cy="4" r="17" fill="#087f7440" stroke="#087f74" stroke-width="2"/><path d="M8 4v29l7-7 6 13 6-3-6-12 11-1Z" fill="#172324" stroke="white" stroke-width="2.5" stroke-linejoin="round"/></svg>';
      document.body.append(cursor);
    }
    cursor.style.left = `${position.x - 8}px`;
    cursor.style.top = `${position.y - 4}px`;
    cursor.querySelector(".click-ring").style.opacity = position.pressed ? "1" : "0";
  }, pointer);
}

async function frame(duration = 120) {
  await paintPointer();
  const capturedAt = performance.now();
  const previous = frames.at(-1);
  if (previous) previous.duration = Math.max(20, Math.round((capturedAt - previous.capturedAt) / 10) * 10);
  // Frame numbers span both GIFs so resetting the manifest cannot overwrite the AI capture.
  const file = resolve(directory, `${String(frameNumber++).padStart(4, "0")}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, duration, capturedAt, stage, pointer: { ...pointer } });
}

async function hold(duration) {
  for (let elapsed = 0; elapsed < duration; elapsed += 120) {
    await frame();
    await page.waitForTimeout(60);
  }
}

async function saveManifest(name) {
  const manifest = resolve(output, `readme-${name}-frames.json`);
  await writeFile(manifest, JSON.stringify({ origin, viewport: { width: 1440, height: 960 }, question, realTime: true, frames }, null, 2));
  process.stdout.write(`Captured ${frames.length} ${name} frames. Manifest: ${manifest}\n`);
}

async function moveTo(locator) {
  await locator.waitFor({ state: "visible" });
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error(`No visible target in ${stage}`);
  const start = { ...pointer };
  const target = { x: bounds.x + bounds.width / 2, y: bounds.y + Math.min(bounds.height / 2, 120) };
  for (let step = 1; step <= 9; step++) {
    const progress = step / 9;
    const eased = progress * progress * (3 - 2 * progress);
    pointer = { x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, pressed: false };
    await page.mouse.move(pointer.x, pointer.y);
    await frame();
  }
}

async function click(locator) {
  await moveTo(locator);
  pointer.pressed = true;
  await frame(180);
  await page.mouse.click(pointer.x, pointer.y);
  await page.waitForTimeout(180);
  await frame(180);
  pointer.pressed = false;
}

async function settleImages() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images].filter(image => {
      const box = image.getBoundingClientRect();
      return box.top < innerHeight && box.bottom > 0;
    });
    // Failed remote artwork uses the site's own fallback instead of blocking capture.
    await Promise.allSettled(images.map(image => image.decode()));
  });
}

async function captureDiscovery() {
  await page.goto(origin);
  await page.getByRole("button", { name: /^Save / }).first().waitFor({ timeout: 60_000 });
  await settleImages();
  if (captureProduct) await page.screenshot({ path: resolve("docs/readme/desktop.jpg"), type: "jpeg", quality: 88 });
}

async function captureAssistant() {
  await page.getByRole("button", { name: "Ask KiwiCue", exact: true }).click();
  await page.getByRole("textbox", { name: /^Message / }).waitFor();
  stage = "Ask for concerts this weekend";
  await frame();
  await askQuestion();
}

async function installStreamCapture() {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const target = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (new URL(target, location.origin).pathname !== "/api/ask") return originalFetch(...args);
      const capture = { status: 0, body: "", finished: false, error: null };
      window.__readmeAskCapture = capture;
      try {
        const response = await originalFetch(...args);
        capture.status = response.status;
        // Read a clone so recording observes the real stream without delaying UI delivery.
        void readClone(response.clone(), capture);
        return response;
      } catch (error) {
        capture.error = error.message;
        capture.finished = true;
        throw error;
      }
    };
    async function readClone(response, capture) {
      try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let step;
        while (!(step = await reader.read()).done) capture.body += decoder.decode(step.value, { stream: true });
        capture.body += decoder.decode();
      } catch (error) {
        capture.error = error.message;
      } finally {
        capture.finished = true;
      }
    }
  });
}

async function askQuestion() {
  const input = page.getByRole("textbox", { name: /^Message / });
  await moveTo(input);
  for (let length = 4; length < question.length + 4; length += 4) {
    await input.fill(question.slice(0, length));
    await frame(180);
  }
  await hold(600);
  await moveTo(page.getByRole("button", { name: "Send", exact: true }));
  pointer.pressed = true;
  await frame();
  const submittedAt = performance.now();
  await page.mouse.click(pointer.x, pointer.y);
  pointer.pressed = false;
  const result = await captureStream(submittedAt);
  await writeFile(resolve(output, "readme-ai-last-response.json"), JSON.stringify(result, null, 2));
  validateResults(result);
  await verifyEventPosters();
  stage = "Matching activities, ranked with Jev";
  await page.locator(".ask-card").first().scrollIntoViewIfNeeded();
  await hold(3000);
  await page.screenshot({ path: resolve("docs/readme/ai-bot.jpg"), type: "jpeg", quality: 90 });
  await writeFile(resolve("docs/readme/ai-bot-evidence.json"), JSON.stringify(result, null, 2));
}

async function verifyEventPosters() {
  const cards = page.locator(".ask-card");
  for (const card of await cards.all()) {
    await card.scrollIntoViewIfNeeded();
    const poster = card.locator("img").first();
    await poster.waitFor({ state: "visible" });
    await poster.evaluate(async image => {
      await image.decode();
      if (image.naturalWidth === 0) throw new Error("The event poster did not load");
    });
  }
}

async function captureStream(submittedAt) {
  stage = "Jev understands and ranks matching activities";
  let result = null;
  let firstCardMs = null;
  while (!result?.finished && performance.now() - submittedAt < 65_000) {
    await frame();
    if (firstCardMs === null && await page.locator(".ask-card").first().isVisible()) {
      firstCardMs = Math.round(performance.now() - submittedAt);
      stage = "Matching activity cards arrive";
    }
    result = await page.evaluate(() => window.__readmeAskCapture ?? null);
    await page.waitForTimeout(120);
  }
  if (!result?.finished) throw new Error("AI response did not finish within 65 seconds");
  if (result.error) throw new Error(result.error);
  const events = result.body.trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  return { origin, question, recordedAt: new Date().toISOString(), status: result.status, firstCardMs,
    completeMs: Math.round(performance.now() - submittedAt), events };
}

function validateResults(result) {
  const events = result.events;
  const understood = events.find(event => event.type === "understood");
  const cards = events.filter(event => event.type === "result").map(event => event.card);
  if (result.status !== 200 || events.some(event => event.type === "error")) throw new Error("AI request failed; no preview was published");
  if (!events.some(event => event.type === "done") || cards.length < 2) throw new Error("Capture requires a completed response with multiple matching cards");
  if (understood?.filters.domain !== "events" || understood.filters.category !== "music" || understood.filters.dates.length === 0) throw new Error("The search did not retain the requested concert and date filters");
  if (events.some(event => event.type === "relaxed" && event.keys.length > 0)) throw new Error("The preview requires exact matches, without relaxed filters");
  if (!cards.some(card => card.score > 0)) throw new Error("No positive Jev relevance scores were returned");
  const reply = events.filter(event => event.type === "reply").map(event => event.delta).join("");
  if (/DSML/u.test(reply)) throw new Error("The response contains tool protocol markup");
  for (const card of cards) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date(card.when));
    if (card.kind !== "event" || !understood.filters.dates.includes(date) || !card.imageUrl?.startsWith("https://")) {
      throw new Error("A result does not match the requested type or dates");
    }
  }
  process.stdout.write(`Verified ${cards.length} matching activity cards; first visible card ${result.firstCardMs} ms after submit\n`);
}

async function captureDetails() {
  stage = "Open event details";
  await click(page.locator(".ask-card-link").first());
  const save = page.getByRole("button", { name: /^Save / }).first();
  await save.waitFor({ timeout: 60_000 });
  await settleImages();
  await frame(2200);
  stage = "Save without an account";
  await click(save);
  await page.getByRole("button", { name: /^Remove .* from saved events$/ }).waitFor();
  await frame(1800);
}

async function captureSavedAndLanguage() {
  stage = "Find your saved event";
  await click(page.locator('nav[aria-label="Primary navigation"] a[href="/saved"]'));
  await page.getByRole("button", { name: /^Remove .* from saved events$/ }).first().waitFor();
  await settleImages();
  await frame(1800);
  stage = "Switch to Chinese";
  await click(page.getByRole("button", { name: "切换到中文", exact: true }));
  await page.getByRole("button", { name: "Switch to English", exact: true }).waitFor();
  await frame(2200);
}

async function captureReturnAndMobile() {
  stage = "Back to discovery";
  await click(page.locator('a.portal-brand'));
  await page.getByRole("button", { name: /^收藏 / }).first().waitFor({ timeout: 60_000 });
  await settleImages();
  await frame(1600);
  await click(page.getByRole("button", { name: "Switch to English", exact: true }));
  await page.getByRole("button", { name: "切换到中文", exact: true }).waitFor();
  await frame(1600);
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(origin);
  await mobile.getByRole("button", { name: /^Save / }).first().waitFor({ timeout: 60_000 });
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: resolve("docs/readme/mobile.jpg"), type: "jpeg", quality: 88 });
}

try {
  await installStreamCapture();
  await captureDiscovery();
  await captureAssistant();
  await saveManifest("ai");
  if (captureProduct) {
    frames.length = 0;
    await frame();
    await captureDetails();
    await captureSavedAndLanguage();
    await captureReturnAndMobile();
    await saveManifest("demo");
  }
} finally {
  await browser.close();
}
