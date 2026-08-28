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

test("recommendations provide a responsive, bilingual path from the main navigation", async ({ page }, testInfo) => {
  await installRecommendationRoutes(page);
  await page.goto("/recommendations");

  await expect(page.getByRole("heading", { name: "Picks for you" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Picks" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible();
  await expect(page.getByText(/A broad mix beyond the first shortlist/)).toBeVisible();
  await expect(page.getByText(/Preferences stay in this browser/)).toBeVisible();
  await expect(page.locator(".recommendation-card-shell")).toHaveCount(4);
  await expect(page.getByText("Reviewed 4 upcoming listings from 2 available feeds.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Event categories" })).toBeVisible();
  expect(await page.locator(".recommendation-grid").first().evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe("rgba(0, 0, 0, 0)");
  expect(await page.locator(".recommendation-card-shell .portal-event-card").first().evaluate((node) => getComputedStyle(node).borderTopWidth))
    .toBe("0px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/recommendations-${testInfo.project.name}.png`, fullPage: true });
  }

  const firstDetails = page.getByRole("link", { name: "View Music pick music details" });
  await firstDetails.focus();
  expect(await firstDetails.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThan(0);
  const targets = page.locator(".portal-header-link, .language-toggle, .portal-event-link, .bookmark-button, .event-category-card");
  for (let index = 0; index < await targets.count(); index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Save Music pick music" }).click();
  await expect(page.getByRole("heading", { name: "Music pick music" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();
  await expect(page.getByText(/Uses 1 event saved in this browser/)).toBeVisible();

  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "为你推荐" })).toBeVisible();
  await expect(page.getByRole("link", { name: "推荐", exact: true })).toHaveAttribute("aria-current", "page");
});

test("event categories form an accessible, borderless discovery runway", async ({ page }, testInfo) => {
  await installRecommendationRoutes(page);
  await page.route("**/api/venues**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ venues: [] }),
  }));
  await page.goto("/events");

  const categoryNav = page.getByRole("navigation", { name: "Event categories" });
  await expect(categoryNav).toHaveAttribute("data-active", "all");
  await expect(categoryNav.locator(".event-category-card")).toHaveCount(6);
  expect(await categoryNav.locator(".event-category-card").evaluateAll((links) => links.map((link) => link.getAttribute("data-category"))))
    .toEqual(["all", "concerts", "theatre", "markets", "festivals", "sports"]);
  await expect(categoryNav.getByRole("link", { name: /^All\./ })).toHaveAttribute("aria-current", "page");
  await expect(categoryNav.getByRole("link", { name: /Sports/ })).toBeVisible();
  await expect(categoryNav.getByText("Live sport across Auckland")).toBeVisible();
  expect(await categoryNav.locator(".event-category-card").first().evaluate((node) => getComputedStyle(node).borderTopWidth))
    .toBe("0px");
  const firstCategory = categoryNav.locator(".event-category-card").first();
  await firstCategory.focus();
  expect(await firstCategory.evaluate((node) => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThan(0);
  for (let index = 0; index < await categoryNav.locator(".event-category-card").count(); index += 1) {
    const box = await categoryNav.locator(".event-category-card").nth(index).boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  if (testInfo.project.name === "mobile-375") {
    expect(await categoryNav.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  }
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/category-runway-${testInfo.project.name}.png`, fullPage: true });
  }
  await categoryNav.getByRole("link", { name: /Sports/ }).click();
  await expect(page).toHaveURL(/category=sports/);
  await expect(page.getByRole("navigation", { name: "Event categories" })).toHaveAttribute("data-active", "sports");
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/category-runway-sports-${testInfo.project.name}.png`, fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/events?category=sports");
  const deepLinkNav = page.getByRole("navigation", { name: "Event categories" });
  await expect(deepLinkNav).toHaveAttribute("data-active", "sports");
  await expect.poll(() => deepLinkNav.evaluate((navigation) => {
    const activeCategory = navigation.querySelector<HTMLElement>('[aria-current="page"]');
    if (!activeCategory) return Number.POSITIVE_INFINITY;
    const navigationBounds = navigation.getBoundingClientRect();
    const activeBounds = activeCategory.getBoundingClientRect();
    return Math.max(navigationBounds.left - activeBounds.left, activeBounds.right - navigationBounds.right, 0);
  })).toBeLessThanOrEqual(1);
});
