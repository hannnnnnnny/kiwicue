import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ASK !== "1", "Start the server with dummy ask secrets and E2E_ASK=1 to run");

const turns = [
  { reply: "Fun! Who's coming along?", quickReplies: ["Kids", "Friends"], ready: false, summary: null, searchText: null, remaining: 5 },
  { reply: "Great, here's my plan.", quickReplies: [], ready: true, summary: "Sat 3 Oct · with kids", searchText: "Saturday with the kids", remaining: 5 },
];
const search = [
  { type: "understood", filters: { domain: "any", dates: ["2026-10-03"], timeOfDay: "any", area: "any", category: "family", kids: true, free: false, names: [], place: null }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card: { kind: "event", id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 } },
  { type: "best", id: "a" },
  { type: "reply", delta: "Bundle Baby suits little ones." },
  { type: "done", remaining: 4, tier: "guest" },
].map((line) => JSON.stringify(line)).join("\n");

test("chats with Kiwi, confirms, and shows the results without overflow", async ({ page }) => {
  let turn = 0;
  await page.route("**/api/ask/chat", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(turns[Math.min(turn++, 1)]) }));
  await page.route("**/api/ask", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: search }));
  await page.goto("/events");
  const launcher = page.getByRole("button", { name: "Ask KiwiCue" });
  expect((await launcher.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await launcher.click();
  await expect(page.getByText("Hi, I'm Kiwi!", { exact: false })).toBeVisible();

  await page.getByRole("textbox", { name: "Message Kiwi" }).fill("Something this Saturday");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Kids" }).click();
  const plan = page.getByRole("group", { name: "I'll search for" });
  await expect(plan).toContainText("Sat 3 Oct · with kids");
  await plan.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("article", { name: /Best match: Bundle Baby/ })).toBeVisible();
  await expect(page.getByText("Bundle Baby suits little ones.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(launcher).toBeFocused();
});
