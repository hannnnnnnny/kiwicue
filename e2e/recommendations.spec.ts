import { expect, test, type Page, type Route } from "@playwright/test";

function futureIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(7, 0, 0, 0);
  return date.toISOString();
}

function event(id: string, category: string, days: number) {
  const dateTime = futureIso(days);
  return {
    id,
    name: `${category} pick ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: null,
    start: {
      localDate: dateTime.slice(0, 10),
      localTime: "19:00:00",
      dateTime,
      timezone: "Pacific/Auckland",
    },
    status: "onsale",
    category,
    venue: {
      id: `venue-${id}`,
      name: `Venue ${id}`,
      city: "Auckland",
      address: null,
      postalCode: null,
      coordinates: null,
    },
  };
}

function json(route: Route, events: ReturnType<typeof event>[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      events,
      page: { size: 50, totalElements: events.length, totalPages: 1, number: 0 },
      nextCursor: null,
    }),
  });
}

async function installRecommendationRoutes(page: Page) {
  await page.route("**/api/events?**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("category") === "markets") {
      return json(route, [event("market", "Market", 9)]);
    }
    return json(route, [
      event("music", "Music", 5),
      event("sport", "Sports", 6),
      event("theatre", "Arts & Theatre", 7),
    ]);
  });
}

test("recommendations provide a responsive, bilingual path from the main navigation", async ({ page }) => {
  await installRecommendationRoutes(page);
  await page.goto("/recommendations");

  await expect(page.getByRole("heading", { name: "Picks for you" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Picks" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();
  await expect(page.getByText("Your saved events stay in this browser.")).toBeVisible();
  await expect(page.locator(".recommendation-card-shell")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "为你推荐" })).toBeVisible();
  await expect(page.getByRole("link", { name: "推荐", exact: true })).toHaveAttribute("aria-current", "page");
});

test("event categories are descriptive, reachable and include sport", async ({ page }) => {
  await installRecommendationRoutes(page);
  await page.route("**/api/venues**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ venues: [] }),
  }));
  await page.goto("/events");

  const categoryNav = page.getByRole("navigation", { name: "Event categories" });
  await expect(categoryNav.getByRole("link", { name: /Sports/ })).toBeVisible();
  await expect(categoryNav.getByText("Live sport across Auckland")).toBeVisible();
  await categoryNav.getByRole("link", { name: /Sports/ }).click();
  await expect(page).toHaveURL(/category=sports/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
