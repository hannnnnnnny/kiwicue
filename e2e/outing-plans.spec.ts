import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ASK !== "1", "Requires dummy ask configuration; all assistant responses are intercepted.");

const reply = [
  { type: "understood", filters: { domain: "movies", dates: ["2026-10-03"], timeOfDay: "afternoon", area: "north", category: "any", kids: true, free: false, names: [], place: "Albany", maxPrice: null, totalBudget: 60, partySize: 3 }, chips: [{ key: "totalBudget", label: "Total budget $60" }] },
  { type: "result", card: { kind: "movie", id: "film-a", title: "Family Film", when: "2026-10-03T14:00:00+13:00", venue: "EVENT Cinemas Albany", href: "/movies?q=Family+Film&date=all", imageUrl: null, priceText: null, sessionCount: 1, score: 1, bookingUrl: "https://eventcinemas.co.nz/orders/tickets#sessionId=123", budgetStatus: "unknown", minPartyCost: null, durationMinutes: 90, indoor: true } },
  { type: "reply", delta: "Family Film is an indoor option, but the total budget is unverified." },
  { type: "done", remaining: 25, tier: "guest" },
].map((event) => JSON.stringify(event)).join("\n");

test("preserves the chat across navigation and saves a selectable plan with safe calendar export", async ({ page }) => {
  await page.route("**/api/ask", (route) => route.fulfill({ contentType: "application/x-ndjson", body: reply }));
  await page.goto("/events");
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  await page.getByRole("textbox", { name: "Message Fern" }).fill("Saturday afternoon, two adults and one child, total $60");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Price unknown; budget unverified")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book Family Film on the official site" })).toHaveAttribute("href", "https://eventcinemas.co.nz/orders/tickets#sessionId=123");
  await page.getByText("Select activities and save a plan", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Family Film/ }).check();
  await page.getByLabel("Plan name", { exact: true }).fill("Saturday family outing");
  await page.getByRole("button", { name: "Save on this device" }).click();
  await page.getByRole("link", { name: "View plans" }).click();
  await expect(page.getByRole("heading", { name: "Saturday family outing" })).toBeVisible();
  await expect(page.getByText("Some prices are unknown; the total budget is unverified.")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export calendar" }).click();
  expect((await download).suggestedFilename()).toMatch(/^kiwicue-.*\.ics$/u);
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  await expect(page.getByText("Family Film is an indoor option, but the total budget is unverified.")).toBeVisible();
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByText("Family Film is an indoor option, but the total budget is unverified.")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
