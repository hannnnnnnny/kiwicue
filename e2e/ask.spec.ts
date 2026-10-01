import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_ASK !== "1", "Start the server with dummy ask secrets and E2E_ASK=1 to run");

const search = [
  { type: "understood", filters: { domain: "any", dates: ["2026-10-03"], timeOfDay: "any", area: "any", category: "family", kids: true, free: false, names: [], place: null }, chips: [{ key: "kids", label: "With kids" }] },
  { type: "result", card: { kind: "event", id: "a", title: "Bundle Baby", when: "2026-10-03T10:00:00+13:00", venue: "Aotea Centre", href: "/events/a", imageUrl: null, priceText: "Free", sessionCount: 15, score: 1 } },
  { type: "best", id: "a" },
  { type: "reply", delta: "Bundle Baby suits little ones." },
  { type: "done", remaining: 4, tier: "guest" },
].map((line) => JSON.stringify(line)).join("\n");

test("answers the first message with results, then refines them from a follow-up", async ({ page }) => {
  const bodies: Array<{ text: string; previous: unknown }> = [];
  await page.route("**/api/ask", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, contentType: "application/x-ndjson", body: search });
  });
  await page.goto("/events");
  const launcher = page.getByRole("button", { name: "Ask KiwiCue" });
  expect((await launcher.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await launcher.click();
  await expect(page.getByText("Hi, I'm Kiwi!", { exact: false })).toBeVisible();

  await page.getByRole("textbox", { name: "Message Kiwi" }).fill("Something with the kids");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("article", { name: /Best match: Bundle Baby/ })).toBeVisible();
  await expect(page.getByText("Bundle Baby suits little ones.")).toBeVisible();
  await page.getByRole("button", { name: "Central" }).click();
  await expect(page.getByText(/^Earlier · 1 result/u)).toBeVisible();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ text: "Central", previous: { kids: true } });

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(launcher).toBeFocused();
});

test("loosens a search that found nothing exact and keeps the conversation going", async ({ page }) => {
  const relaxed = search.split("\n");
  relaxed.splice(1, 0, JSON.stringify({ type: "relaxed", keys: ["kids"] }));
  await page.route("**/api/ask", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: relaxed.join("\n") }));
  await page.goto("/events");
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  await page.getByRole("textbox", { name: "Message Kiwi" }).fill("Saturday with the kids");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("No exact match — here are the closest.")).toBeVisible();
  await expect(page.getByText("Nothing matched exactly, so these are the closest. Want to adjust?")).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByText("Sure — what are you after this time?")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("leads a movie best match with a muted autoplaying trailer and thumbnails the rest", async ({ page }) => {
  const movieSearch = [
    { type: "understood", filters: { domain: "movies", dates: [], timeOfDay: "any", area: "any", category: "any", kids: true, free: false, names: [], place: null, maxPrice: null }, chips: [{ key: "domain", label: "Movies" }] },
    { type: "result", card: { kind: "movie", id: "movie:zootopia 2", title: "Zootopia 2", when: "2026-10-03T02:00:00.000Z", venue: "HOYTS Sylvia Park", href: "/movies?q=Zootopia%202", imageUrl: null, priceText: null, sessionCount: 6, score: 1 } },
    { type: "result", card: { kind: "movie", id: "movie:paw patrol", title: "Paw Patrol", when: "2026-10-03T03:00:00.000Z", venue: "Event Queen St", href: "/movies?q=Paw%20Patrol", imageUrl: null, priceText: null, sessionCount: 2, score: 0.6 } },
    { type: "best", id: "movie:zootopia 2" },
    { type: "media", id: "movie:zootopia 2", imageUrl: "https://image.tmdb.org/t/p/w500/zootopia.jpg", trailerKey: "dQw4w9WgXcQ" },
    { type: "reply", delta: "Zootopia 2 is a fun one for the kids." },
    { type: "done", remaining: 4, tier: "guest" },
  ].map((line) => JSON.stringify(line)).join("\n");
  await page.route("**/api/ask", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: movieSearch }));
  await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" }));
  await page.goto("/events");
  await page.getByRole("button", { name: "Ask KiwiCue" }).click();
  await page.getByRole("textbox", { name: "Message Kiwi" }).fill("A movie with the kids");
  await page.getByRole("button", { name: "Send" }).click();

  const trailer = page.getByTitle("Zootopia 2 trailer");
  await expect(trailer).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*autoplay=1.*mute=1/u);
  await page.getByRole("button", { name: "Sound on" }).click();
  await expect(trailer).toHaveAttribute("src", /mute=0/u);
  await expect(page.locator(".ask-card-thumb").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
