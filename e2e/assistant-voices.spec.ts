import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ASK !== "1", "Requires assistant configuration; speech is mocked without microphone access.");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const playback: Array<{ voice: string; lang: string }> = [];
    Object.defineProperty(window, "voicePlayback", { value: playback });
    const voices = ["en-NZ", "zh-CN"].flatMap((lang) => Array.from({ length: 5 }, (_, index) => ({ name: `Natural ${lang} ${index}`, lang, voiceURI: `${lang}-${index}` })));
    class Utterance {
      lang = ""; voice: { voiceURI: string } | null = null; rate = 1; pitch = 1;
      onend: (() => void) | null = null; onerror = null;
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance });
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => voices, cancel: () => undefined,
      speak: (utterance: Utterance) => { playback.push({ voice: utterance.voice?.voiceURI ?? "default", lang: utterance.lang }); queueMicrotask(() => utterance.onend?.()); },
    } });
  });
});

test("switching assistants changes the actual synthesis voice on every screen size", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  for (const name of ["Iris", "Rua", "Sunny", "Kai", "Fern"]) {
    await page.getByRole("button", { name: "Change assistant" }).click();
    await expect(page.getByText(/Available voices depend on your device/)).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(name) }).locator("..").click();
    await expect(page.getByRole("dialog", { name })).toBeVisible();
  }
  const played = await page.evaluate(() => (window as unknown as { voicePlayback: Array<{ voice: string }> }).voicePlayback.map((item) => item.voice));
  expect(new Set(played).size).toBe(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Chinese replies use the selected assistant's Mandarin voice", async ({ page }) => {
  await page.route("**/api/ask", (route) => route.fulfill({ contentType: "application/x-ndjson", body: [
    { type: "reply", delta: "可以，那就选这场。" }, { type: "done", remaining: 20, tier: "guest" },
  ].map((event) => JSON.stringify(event)).join("\n") }));
  await page.goto("/events");
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  await page.getByRole("textbox", { name: "Message Fern" }).fill("那帮我选一个吧");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("可以，那就选这场。")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { voicePlayback: Array<{ voice: string; lang: string }> }).voicePlayback.at(-1))).toEqual({ voice: "zh-CN-3", lang: "zh-CN" });
});
