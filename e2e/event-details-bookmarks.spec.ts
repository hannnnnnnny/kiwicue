import { expect, test, type Page, type Route } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-29T00:00:00+12:00"));
});

const event = {
  id: "audit-event",
  name: "Audit Harbour Live",
  url: "https://www.ticketmaster.co.nz/event/audit-event",
  imageUrl: null,
  start: {
    localDate: "2026-09-08",
    localTime: "19:30:00",
    dateTime: "2026-09-08T07:30:00Z",
    timezone: "Pacific/Auckland",
  },
  status: "onsale",
  category: "Music",
  venue: {
    id: "civic",
    name: "The Civic",
    city: "Auckland",
    address: "269 Queen Street",
    postalCode: "1010",
    coordinates: { latitude: -36.8512, longitude: 174.7635 },
  },
  description: "A verified fixture for the complete event-detail journey.",
  note: "Check the official listing before travelling.",
};

const secondEvent = {
  ...event,
  id: "audit-second",
  name: "Audit Waterfront Market",
  url: "https://www.ticketmaster.co.nz/event/audit-second",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockExternalPages(page: Page) {
  await page.route("https://www.openstreetmap.org/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>OpenStreetMap fixture</title>",
  }));
  await page.context().route("https://www.ticketmaster.co.nz/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Official fixture</title>",
  }));
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
}

async function expectMinimumTouchTarget(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    expect(count, `${selector} should match a rendered action`).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const element = elements.nth(index);
      await expect(element, `${selector} should be visible`).toBeVisible();
      const box = await element.boundingBox();
      expect(box?.height, selector).toBeGreaterThanOrEqual(44);
      expect(box?.width, selector).toBeGreaterThanOrEqual(44);
    }
  }
}

test("detail keeps booking, map, distance, and a persistent bookmark in one safe journey", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mockExternalPages(page);
  await page.route("**/api/events/audit-event", (route) => json(route, { event }));
  await page.addInitScript(() => {
    const instrumentedWindow = window as Window & { __locationCalls?: number };
    instrumentedWindow.__locationCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          instrumentedWindow.__locationCalls = (instrumentedWindow.__locationCalls ?? 0) + 1;
          success({
            coords: {
              latitude: -36.8485,
              longitude: 174.7633,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });

  await page.goto("/events/audit-event");
  await expect(page.getByRole("heading", { level: 1, name: event.name })).toBeVisible();
  await expect(page.getByText(event.description)).toBeVisible();
  await expect(page.getByText(event.note)).toBeVisible();
  await expect(page.getByText("269 Queen Street")).toBeVisible();
  await expect(page.getByTitle("Map of The Civic")).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute("rel", /noopener/);
  expect(await page.evaluate(() => (window as Window & { __locationCalls?: number }).__locationCalls)).toBe(0);

  await page.getByRole("button", { name: "Show distance from me" }).click();
  await expect(page.getByRole("status")).toContainText(/About .* km away/);
  expect(await page.evaluate(() => (window as Window & { __locationCalls?: number }).__locationCalls)).toBe(1);

  await page.getByRole("button", { name: `Save ${event.name}` }).click();
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Remove ${event.name} from saved events` })).toBeVisible();

  const official = page.getByRole("link", { name: "Continue to official booking" });
  await expect(official).toHaveAttribute("href", event.url);
  await expect(official).toHaveAttribute("rel", /noopener/);
  const [popup] = await Promise.all([page.waitForEvent("popup"), official.click()]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();

  await expectMinimumTouchTarget(page, [
    ".event-detail-back",
    ".bookmark-button-detail",
    ".distance-panel button",
    ".event-booking-inline",
    ".event-booking-action",
    ".event-map figcaption a",
  ]);
  await expectNoHorizontalOverflow(page);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/event-detail-${testInfo.project.name}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("detail provides not-found, retry, missing-description, and missing-map recovery", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let mode: "not-found" | "retry" = "not-found";
  let retryRequests = 0;
  await page.route("**/api/events/audit-event", (route) => {
    if (mode === "not-found") return json(route, { error: { message: "Event not found" } }, 404);
    retryRequests += 1;
    if (retryRequests === 1) return json(route, { error: { message: "Unavailable" } }, 503);
    return json(route, {
      event: {
        ...event,
        description: null,
        note: null,
        venue: { ...event.venue, coordinates: null },
      },
    });
  });

  await page.goto("/events/audit-event");
  await expect(page.getByRole("heading", { name: "Event not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Auckland events" })).toHaveAttribute("href", "/events");
  await expectNoHorizontalOverflow(page);

  mode = "retry";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Event details are temporarily unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Retry event details" }).click();
  await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event information" })).toHaveCount(0);
  await expect(page.getByText("Map and distance are unavailable because this venue has no coordinates yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to official booking" })).toBeVisible();
  await expect(page.getByTitle("Map of The Civic")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show distance from me" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("location denial stays private, recoverable, bilingual, and overflow safe", async ({ page }) => {
  await mockExternalPages(page);
  await page.route("**/api/events/audit-event", (route) => json(route, { event }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(_success: PositionCallback, failure: PositionErrorCallback) {
          failure({
            code: 1,
            message: "private browser detail",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        },
      },
    });
  });

  await page.goto("/events/audit-event");
  await page.getByRole("button", { name: "Show distance from me" }).click();
  await expect(page.locator(".distance-error")).toContainText("Location access is off");
  await expect(page.getByText("private browser detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try location again" })).toBeEnabled();

  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".distance-error")).toContainText("定位权限未开启");
  await expect(page.getByRole("button", { name: "重新获取位置" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("saved events invalidate stale clear confirmation and support a complete Chinese clear flow", async ({ page }, testInfo) => {
  const bookmarks = {
    version: 1,
    items: [event, secondEvent].map((savedEvent, index) => ({
      event: savedEvent,
      savedAt: new Date(Date.UTC(2026, 7, 1, index)).toISOString(),
    })),
  };
  await page.addInitScript((payload) => {
    localStorage.setItem("kiwicue:bookmarks:v1", JSON.stringify(payload));
  }, bookmarks);
  await page.route("**/api/events/**", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    return json(route, { event: id === secondEvent.id ? secondEvent : event });
  });

  await page.goto("/saved");
  await expect(page.getByText("2 saved events", { exact: true })).toBeVisible();
  await expectMinimumTouchTarget(page, [
    ".saved-link",
    ".language-toggle",
    ".saved-toolbar button",
    ".bookmark-button-card",
  ]);
  await page.getByRole("button", { name: "Clear all saved events" }).click();
  await expect(page.getByRole("button", { name: "Confirm clearing all saved events" })).toBeVisible();
  await page.getByRole("button", { name: `Remove ${event.name} from saved events` }).click();
  await expect(page.getByRole("button", { name: "Clear all saved events" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();

  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "我收藏的活动" })).toBeVisible();
  await page.getByRole("button", { name: "清空全部收藏" }).click();
  await expect(page.getByRole("heading", { name: secondEvent.name })).toBeVisible();
  await page.getByRole("button", { name: "确认清空全部收藏" }).click();
  await expect(page.getByRole("heading", { name: "还没有收藏活动" })).toBeVisible();
  await expect(page.getByRole("link", { name: "收藏活动，0 个" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kiwicue:bookmarks:v1"))).toBeNull();
  await expectMinimumTouchTarget(page, [".portal-empty-action"]);
  await expectNoHorizontalOverflow(page);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/saved-empty-${testInfo.project.name}.png`, fullPage: true });
  }
});
