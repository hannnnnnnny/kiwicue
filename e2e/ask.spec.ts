import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ASK !== "1", "Start the server with dummy ask secrets and E2E_ASK=1 to run");

const lines = [
  { type: "understood", filters: { domain: "any", dates: [], timeOfDay: "any", area: "any", category: "family", kids: true, free: false, names: [], place: null }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card: { kind: "event", id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 } },
  { type: "result", card: { kind: "movie", id: "movie:paw patrol", title: "Paw Patrol", when: "2026-10-03T02:00:00.000Z", venue: "HOYTS Sylvia Park", href: "/movies?q=Paw%20Patrol", imageUrl: null, priceText: null, sessionCount: 4, score: 0.6 } },
  { type: "best", id: "a" },
  { type: "reply", delta: "Bundle Baby suits little ones." },
  { type: "done", remaining: 4, tier: "guest" },
].map((line) => JSON.stringify(line)).join("\n");

test("asks by text and shows the streamed answer without overflow", async ({ page }) => {
  await page.route("**/api/ask", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: lines }));
  await page.goto("/events");
  const launcher = page.getByRole("button", { name: "Ask KiwiCue" });
  expect((await launcher.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await launcher.click();
  await page.getByRole("textbox", { name: "Ask anything" }).fill("something for kids");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByRole("article", { name: /Best match: Bundle Baby/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Paw Patrol/ })).toBeVisible();
  await expect(page.getByText("Bundle Baby suits little ones.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(launcher).toBeFocused();
});
