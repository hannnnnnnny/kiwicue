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
const withReply = process.argv.includes("--with-reply");
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
  // Frame numbers span both GIFs so resetting the manifest cannot overwrite the AI capture.
  const file = resolve(directory, `${String(frameNumber++).padStart(4, "0")}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, duration, stage, pointer: { ...pointer } });
}

async function hold(duration) {
  for (let elapsed = 0; elapsed < duration; elapsed += 120) {
    await frame();
    await page.waitForTimeout(60);
  }
}

async function saveManifest(name) {
  const manifest = resolve(output, `readme-${name}-frames.json`);
  await writeFile(manifest, JSON.stringify({ origin, viewport: { width: 1440, height: 960 }, withReply, frames }, null, 2));
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
  await page.screenshot({ path: resolve("docs/readme/desktop.jpg"), type: "jpeg", quality: 88 });
  await frame(1600);
}

async function captureAssistant() {
  stage = "Ask the AI outing guide";
  await click(page.getByRole("button", { name: "Ask KiwiCue", exact: true }));
  await hold(960);
  stage = "Choose from five animated assistants";
  await click(page.getByRole("button", { name: "Change assistant", exact: true }));
  await hold(1200);
  await page.screenshot({ path: resolve("docs/readme/ai-bot.jpg"), type: "jpeg", quality: 90 });
  for (const name of ["Iris", "Rua", "Sunny", "Kai", "Fern"]) {
    stage = `Meet ${name}`;
    await click(page.locator(`[data-assistant-option="${name.toLowerCase()}"]`));
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await hold(840);
    if (name !== "Fern") await click(page.getByRole("button", { name: "Change assistant", exact: true }));
  }
  if (withReply) await askQuestion();
  else await previewInput();
}

async function previewInput() {
  stage = "Type a natural-language question";
  const input = page.getByRole("textbox", { name: "Message Fern", exact: true });
  await moveTo(input);
  const question = "Show me Auckland markets this weekend";
  for (let length = 4; length < question.length + 4; length += 4) {
    await input.fill(question.slice(0, length));
    await frame(180);
  }
  await hold(1200);
  stage = "Choose the voice input language";
  await click(page.getByRole("button", { name: "Voice input: English. Switch to Chinese", exact: true }));
  await hold(960);
}

async function askQuestion() {
  stage = "Ask in natural language";
  const input = page.getByRole("textbox", { name: "Message Fern", exact: true });
  await moveTo(input);
  const question = "Show me Auckland markets this weekend";
  for (let length = 4; length < question.length + 4; length += 4) {
    await input.fill(question.slice(0, length));
    await frame(180);
  }
  await frame(900);
  const response = page.waitForResponse(result => result.url() === `${origin}/api/ask`);
  await click(page.getByRole("button", { name: "Send", exact: true }));
  const result = await response;
  if (!result.ok()) throw new Error(`AI request returned ${result.status()}: ${await result.text()}`);
  stage = "AI filters and recommendations";
  for (let index = 0; index < 14; index++) {
    await frame(180);
    await page.waitForTimeout(180);
  }
  await result.finished();
  await page.locator(".ask-card").first().waitFor({ timeout: 60_000 });
  await settleImages();
  await frame(3500);
  await writeFile(resolve(output, "readme-ai-response.txt"), await page.getByRole("dialog").innerText());
}

async function captureDetails() {
  stage = "Open event details";
  if (withReply) await click(page.locator(".ask-card-link").first());
  else await click(page.getByRole("link", { name: /^View .* details$/ }).first());
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
  await captureDiscovery();
  await captureAssistant();
  await saveManifest("ai");
  if (!withReply) await click(page.getByRole("button", { name: "Close", exact: true }));
  frames.length = 0;
  await frame(1600);
  await captureDetails();
  await captureSavedAndLanguage();
  await captureReturnAndMobile();
  await saveManifest("demo");
} finally {
  await browser.close();
}
