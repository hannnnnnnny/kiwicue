import { expect, test, type Page, type Route } from "@playwright/test";

type RouteOptions = {
  initialFailures?: number;
  appendFailures?: number;
  venueFailure?: boolean;
  appendDelayMs?: number;
};

const transparentGif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

const pagesWithAssetRoutes = new WeakSet<Page>();

function event(id: string, name: string, options: { image?: boolean; status?: string } = {}) {
  return {
    id,
    name,
    url: `https://www.ticketmaster.co.nz/event/${id}`,
    imageUrl: options.image ? "https://images.example/harbour.gif" : null,
    start: {
      localDate: "2026-08-01",
      localTime: "19:30:00",
      dateTime: "2026-08-01T07:30:00Z",
      timezone: "Pacific/Auckland",
    },
    status: options.status ?? "onsale",
    category: "Music",
    priceRange: null,
    venue: {
      id: "civic",
      name: "The Civic",
      city: "Auckland",
      address: "269 Queen Street",
      postalCode: "1010",
      coordinates: null,
    },
  };
}

const firstPage = {
  events: [
    event("event-1", "Harbour Lights", { image: true }),
    event("event-2", "A very long Auckland event title that remains readable on a small screen", { status: "cancelled" }),
  ],
  page: { size: 50, totalElements: 3, totalPages: 2, number: 0 },
  nextCursor: "page-two",
};

const secondPage = {
  events: [event("event-2", "Duplicate must not render"), event("event-3", "Waterfront Night Market")],
  page: { size: 50, totalElements: 3, totalPages: 2, number: 1 },
  nextCursor: null,
};

const filteredPage = {
  events: [event("event-taylor", "Taylor Night Auckland")],
  page: { size: 50, totalElements: 1, totalPages: 1, number: 0 },
  nextCursor: null,
};

const laufeyPage = {
  events: [event("event-laufey", "Laufey - A Matter Of Time Tour")],
  page: { size: 50, totalElements: 1, totalPages: 1, number: 0 },
  nextCursor: null,
};

const eventDetail = {
  ...event("event-1", "Harbour Lights", { image: true }),
  description: "A live Auckland performance presented by the official organiser.",
  note: "Check the official listing for final entry requirements.",
  venue: {
    id: "civic",
    name: "The Civic",
    city: "Auckland",
    address: "269 Queen Street",
    postalCode: "1010",
    coordinates: { latitude: -36.8512, longitude: 174.7635 },
  },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installRoutes(page: Page, options: RouteOptions = {}) {
  const eventRequests: string[] = [];
  const venueRequests: string[] = [];
  let initialFailures = options.initialFailures ?? 0;
  let appendFailures = options.appendFailures ?? 0;

  if (!pagesWithAssetRoutes.has(page)) {
    await page.route("https://images.example/**", (route) => route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: transparentGif,
    }));
    await page.route("https://www.openstreetmap.org/**", (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>OpenStreetMap fixture</title>",
    }));
    pagesWithAssetRoutes.add(page);
  }
  await page.route("**/api/venues**", async (route) => {
    venueRequests.push(route.request().url());
    if (options.venueFailure) return json(route, { error: { message: "Unavailable" } });
    return json(route, {
      venues: [
        { id: "civic", name: "The Civic" },
        { id: "spark", name: "Spark Arena" },
      ],
    });
  });
  await page.route("**/api/events**", async (route) => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    if (url.pathname.endsWith("/api/events/suggestions")) {
      return json(route, {
        suggestions: url.searchParams.get("q")?.toLocaleLowerCase().includes("lauf")
          ? [{
            name: "Laufey - A Matter Of Time Tour",
            category: "Music",
            localDate: "2026-08-14",
            venueName: "Spark Arena",
          }]
          : [],
      });
    }
    if (url.pathname.endsWith("/api/events/event-1")) {
      return json(route, { event: eventDetail });
    }
    eventRequests.push(requestUrl);
    if (url.searchParams.has("cursor")) {
      if (options.appendDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.appendDelayMs));
      }
      if (appendFailures > 0) {
        appendFailures -= 1;
        return json(route, { error: { message: "Unavailable" } });
      }
      return json(route, secondPage);
    }
    if (initialFailures > 0) {
      initialFailures -= 1;
      return json(route, { error: { message: "Unavailable" } });
    }
    if (url.searchParams.get("q") === "NoSuchActivity") {
      return json(route, {
        events: [],
        page: { size: 50, totalElements: 0, totalPages: 0, number: 0 },
        nextCursor: null,
      });
    }
    if (url.searchParams.get("q") === "Laufey - A Matter Of Time Tour") {
      return json(route, laufeyPage);
    }
    if (url.searchParams.has("q") || url.searchParams.has("venue")) {
      return json(route, filteredPage);
    }
    return json(route, firstPage);
  });

  return { eventRequests, venueRequests };
}

async function resetApiRoutes(page: Page) {
  await page.unroute("**/api/venues**");
  await page.unroute("**/api/events**");
}

function runtimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    bodyClient: document.body.clientWidth,
    bodyScroll: document.body.scrollWidth,
  }));
  expect(dimensions.documentScroll).toBeLessThanOrEqual(dimensions.documentClient);
  expect(dimensions.bodyScroll).toBeLessThanOrEqual(dimensions.bodyClient);
}

async function measureLoadMoreLayout(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector(".event-grid")?.getBoundingClientRect();
    const button = document.querySelector(".event-load-more")?.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".portal-event-card")]
      .map((card) => card.getBoundingClientRect().height);
    return {
      scrollY,
      documentHeight: document.documentElement.scrollHeight,
      gridHeight: grid?.height ?? null,
      buttonTop: button?.top ?? null,
      cards,
    };
  });
}

async function tabTo(page: Page, locator: ReturnType<Page["locator"]>) {
  await page.keyboard.press("Tab");
  await expect(locator).toBeFocused();
  expect(await locator.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThan(0);
}

test("redirects into a named, touchable, overflow-safe responsive portal", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  await page.getByRole("link", { name: "Skip to event results" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/events#event-results$/);
  await page.getByRole("link", { name: "KiwiCue Auckland events home" }).click();
  await expect(page).toHaveURL(/\/events$/);
  const search = page.getByRole("search", { name: "Search Auckland events" });
  await expect(search).toBeVisible();
  expect(await search.evaluate((element) => element.getBoundingClientRect().top < innerHeight)).toBe(true);

  const unnamed = await page.locator("a, button, input, select").evaluateAll((elements) => elements
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    })
    .filter((element) => {
      const control = element as HTMLInputElement;
      const labels = Array.from(control.labels ?? []).map((label) => label.textContent ?? "").join(" ");
      return !(element.getAttribute("aria-label") || labels || element.textContent || element.getAttribute("title"))?.trim();
    })
    .map((element) => element.outerHTML));
  expect(unnamed).toEqual([]);

  const deadLinks = await page.locator("a").evaluateAll((links) => links
    .filter((link) => !link.getAttribute("href") || link.getAttribute("href") === "#")
    .map((link) => link.outerHTML));
  expect(deadLinks).toEqual([]);

  const touchTargets = page.locator([
    ".portal-brand", ".portal-header-link", ".language-toggle", ".event-search-input", ".event-search-select",
    ".event-search-submit", ".portal-nav-link", ".portal-event-link", ".bookmark-button", ".event-load-more",
  ].join(","));
  for (let index = 0; index < await touchTargets.count(); index += 1) {
    const box = await touchTargets.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const columns = await page.locator(".event-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns).toBe(testInfo.project.name === "desktop" ? 4 : testInfo.project.name === "tablet-768" ? 2 : 1);
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === "desktop") {
    const category = page.getByRole("link", { name: "Concerts", exact: true });
    await category.hover();
    await expect.poll(() => category.evaluate((element) => getComputedStyle(element).borderColor))
      .toBe("rgb(31, 91, 69)");
    const box = await category.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
    await page.mouse.down();
    expect(await category.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }

  const counts = { events: requests.eventRequests.length, venues: requests.venueRequests.length };
  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "奥克兰最近有什么活动？" })).toBeVisible();
  await page.locator(".language-toggle").click();
  await expect(page.getByRole("heading", { name: "What’s on in Auckland?" })).toBeVisible();
  await page.waitForTimeout(100);
  expect(requests.eventRequests).toHaveLength(counts.events);
  expect(requests.venueRequests).toHaveLength(counts.venues);
  expect(errors).toEqual([]);
});

test("keyboard reaches every portal control in document order with visible focus", async ({ page }) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();

  await tabTo(page, page.getByRole("link", { name: "Skip to event results" }));
  await tabTo(page, page.getByRole("link", { name: "KiwiCue Auckland events home" }));
  await tabTo(page, page.getByRole("link", { name: "Events", exact: true }));
  await tabTo(page, page.getByRole("link", { name: "Saved events, 0" }));
  await tabTo(page, page.getByRole("button", { name: "切换到中文" }));
  await tabTo(page, page.getByLabel("Activity name"));
  await tabTo(page, page.getByLabel("Venue"));
  await tabTo(page, page.getByRole("button", { name: "Search events" }));

  for (const label of ["All", "Concerts", "Theatre", "Markets", "Festivals"]) {
    await tabTo(page, page.getByRole("link", { name: label, exact: true }));
  }
  for (const label of ["Next 7 days", "This weekend", "Next 30 days", "All future"]) {
    await tabTo(page, page.getByRole("link", { name: label, exact: true }));
  }
  await tabTo(page, page.getByRole("link", { name: "View Harbour Lights details" }));
  await tabTo(page, page.getByRole("button", { name: "Save Harbour Lights" }));
  await tabTo(page, page.getByRole("link", { name: /View A very long Auckland/ }));
  await tabTo(page, page.getByRole("button", { name: /Save A very long Auckland/ }));
  await tabTo(page, page.getByRole("button", { name: "Show 1 more event" }));
  expect(errors).toEqual([]);
});

test("saving an event persists through reload and can be removed from Saved", async ({ page }) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();

  await page.getByRole("button", { name: "Save Harbour Lights" }).click();
  await expect(page.getByRole("button", { name: "Remove Harbour Lights from saved events" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();

  await page.getByRole("link", { name: "Saved events, 1" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: "Saved events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  await page.getByRole("button", { name: "Remove Harbour Lights from saved events" }).click();
  await expect(page.getByRole("heading", { name: "No saved events yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Saved events, 0" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("search, clear, back, forward, and reload keep one canonical shareable state", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page);
  await page.goto("/events?window=weekend&category=concerts");
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  await page.getByLabel("Activity name").fill("  Taylor   Swift ");
  await page.getByLabel("Venue").selectOption("civic");

  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(".event-search-submit");
    button?.click();
    button?.click();
  });
  await expect(page).toHaveURL(/\/events\?window=weekend&category=concerts&q=Taylor\+Swift&venue=civic$/);
  await expect(page.getByRole("heading", { name: "Taylor Night Auckland" })).toBeVisible();
  const filteredRequests = requests.eventRequests.filter((request) => request.includes("q=Taylor+Swift"));
  expect(filteredRequests).toHaveLength(1);

  const clear = page.getByRole("link", { name: "Clear filters" });
  await expect(clear).toHaveAttribute("href", "/events?window=weekend&category=concerts");
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 960, height: 900 });
    await expectNoHorizontalOverflow(page);
    const actionBounds = await page.locator(".event-search-actions").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(actionBounds.scrollWidth).toBeLessThanOrEqual(actionBounds.clientWidth);
  }
  await clear.click();
  await expect(page).toHaveURL(/\/events\?window=weekend&category=concerts$/);
  await page.goBack();
  await expect(page).toHaveURL(/q=Taylor\+Swift&venue=civic$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/events\?window=weekend&category=concerts$/);
  await page.reload();
  await expect(page.getByRole("link", { name: "This weekend" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Concerts" })).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("a partial event name opens a selectable, overflow-safe suggestion", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.goto("/events?window=30d&category=concerts");

  const input = page.getByLabel("Activity name");
  await input.fill("lauf");
  const option = page.getByRole("option", { name: /Laufey - A Matter Of Time Tour.*Spark Arena/i });
  await expect(option).toBeVisible();
  expect((await option.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === "mobile-375") {
    await option.click();
  } else {
    await input.press("Enter");
  }
  await expect(page).toHaveURL(
    /\/events\?window=30d&category=concerts&q=Laufey\+-\+A\+Matter\+Of\+Time\+Tour$/,
  );
  await expect(page.getByRole("heading", { name: "Laufey - A Matter Of Time Tour" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("every category and time link navigates, preserves other filters, and requests data", async ({ page }) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page);
  const categories = [
    ["Concerts", "concerts"], ["Theatre", "theatre"], ["Markets", "markets"], ["Festivals", "festivals"],
  ] as const;
  for (const [label, value] of categories) {
    await page.goto("/events?window=weekend&q=Taylor&venue=civic");
    await expect(page.getByRole("heading", { name: "Taylor Night Auckland" })).toBeVisible();
    const before = requests.eventRequests.length;
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`window=weekend&category=${value}&q=Taylor&venue=civic$`));
    await expect.poll(() => requests.eventRequests.length).toBeGreaterThan(before);
  }
  await page.goto("/events?window=weekend&category=concerts&q=Taylor&venue=civic");
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/window=weekend&q=Taylor&venue=civic$/);

  const windows = [
    ["Next 7 days", "7d"], ["This weekend", "weekend"], ["Next 30 days", "30d"],
  ] as const;
  for (const [label, value] of windows) {
    await page.goto("/events?category=markets&q=Taylor&venue=civic");
    await expect(page.getByRole("heading", { name: "Taylor Night Auckland" })).toBeVisible();
    const before = requests.eventRequests.length;
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`window=${value}&category=markets&q=Taylor&venue=civic$`));
    await expect.poll(() => requests.eventRequests.length).toBeGreaterThan(before);
  }
  await page.goto("/events?window=weekend&category=markets&q=Taylor&venue=civic");
  await page.getByRole("link", { name: "All future", exact: true }).click();
  await expect(page).toHaveURL(/\/events\?category=markets&q=Taylor&venue=civic$/);
  expect(errors).toEqual([]);
});

test("load more de-duplicates and the event detail opens a noopener official booking tab", async ({ page }) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page, { appendDelayMs: 180 });
  await page.addInitScript(() => {
    const instrumentedWindow = window as Window & { __kiwicueGeolocationCalls?: number };
    instrumentedWindow.__kiwicueGeolocationCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          instrumentedWindow.__kiwicueGeolocationCalls = (instrumentedWindow.__kiwicueGeolocationCalls ?? 0) + 1;
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
  await page.context().route("https://www.ticketmaster.co.nz/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Official fixture</title>",
  }));
  await page.goto("/events");
  const more = page.getByRole("button", { name: "Show 1 more event" });
  await expect(more).toBeVisible();
  await more.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => scrollY);
  const layoutBefore = await measureLoadMoreLayout(page);
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(".event-load-more");
    button?.click();
    button?.click();
  });
  await expect(page.locator(".event-load-more")).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Waterfront Night Market" })).toBeVisible();
  expect(requests.eventRequests.filter((request) => request.includes("cursor=page-two"))).toHaveLength(1);
  await expect(page.locator(".portal-event-card")).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "A very long Auckland event title that remains readable on a small screen" })).toHaveCount(1);
  const scrollAfter = await page.evaluate(() => scrollY);
  const layoutAfter = await measureLoadMoreLayout(page);
  expect(
    Math.abs(scrollAfter - scrollBefore),
    JSON.stringify({ layoutBefore, layoutAfter }),
  ).toBeLessThanOrEqual(24);

  await page.getByRole("link", { name: "View Harbour Lights details" }).click();
  await expect(page).toHaveURL(/\/events\/event-1$/);
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  await expect(page.getByText("269 Queen Street")).toBeVisible();
  await expect(page.getByTitle("Map of The Civic")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __kiwicueGeolocationCalls?: number }).__kiwicueGeolocationCalls)).toBe(0);
  await page.getByRole("button", { name: "Show distance from me" }).click();
  await expect(page.getByText(/^About .* km away/)).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __kiwicueGeolocationCalls?: number }).__kiwicueGeolocationCalls)).toBe(1);
  await expectNoHorizontalOverflow(page);

  const official = page.getByRole("link", { name: "Continue to official booking" });
  await expect(official).toHaveAttribute("rel", /noopener/);
  const [popup] = await Promise.all([page.waitForEvent("popup"), official.click()]);
  await popup.waitForLoadState();
  await expect(popup).toHaveURL("https://www.ticketmaster.co.nz/event/event-1");
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await popup.close();
  expect(errors).toEqual([]);
});

test("venue, empty, initial error, retry, and append error states stay usable", async ({ page }) => {
  const errors = runtimeErrors(page);
  await installRoutes(page, { venueFailure: true });
  await page.goto("/events");
  await expect(page.getByText("Venue temporarily unavailable")).toBeVisible();
  await expect(page.getByLabel("Activity name")).toBeEnabled();
  await expect(page.getByLabel("Venue")).toBeDisabled();

  await resetApiRoutes(page);
  await installRoutes(page);
  await page.goto("/events?q=NoSuchActivity");
  await expect(page.getByRole("heading", { name: "No matching events found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear all filters" })).toHaveAttribute("href", "/events");

  await resetApiRoutes(page);
  await installRoutes(page, { initialFailures: 1 });
  await page.goto("/events");
  await expect(page.locator(".event-error")).toContainText("temporarily out of range");
  await page.getByRole("button", { name: "Retry event scan" }).click();
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();

  await resetApiRoutes(page);
  await installRoutes(page, { appendFailures: 1 });
  await page.goto("/events");
  await page.getByRole("button", { name: "Show 1 more event" }).click();
  await expect(page.locator(".event-load-more-error")).toContainText("shown events are still here");
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  await page.getByRole("button", { name: "Retry loading more events" }).click();
  await expect(page.getByRole("heading", { name: "Waterfront Night Market" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile filters wrap without clipping and reduced motion disables media animation", async ({ page }) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();

  const imageMotion = await page.locator(".portal-event-media img").evaluate((element) => ({
    transition: getComputedStyle(element).transitionDuration,
    animation: getComputedStyle(element).animationName,
  }));
  expect(imageMotion.transition).toBe("0s");
  expect(imageMotion.animation).toBe("none");

  if ((page.viewportSize()?.width ?? 0) <= 600) {
    for (const nav of ["Event categories", "Event time range"]) {
      const track = page.getByRole("navigation", { name: nav });
      const dimensions = await track.evaluate((element) => {
        const trackRect = element.getBoundingClientRect();
        const lastRect = element.lastElementChild?.getBoundingClientRect();
        return {
          width: element.scrollWidth,
          client: element.clientWidth,
          lastLeft: lastRect?.left ?? 0,
          lastRight: lastRect?.right ?? 0,
          trackLeft: trackRect.left,
          trackRight: trackRect.right,
        };
      });
      expect(dimensions.width).toBeLessThanOrEqual(dimensions.client);
      expect(dimensions.lastLeft).toBeGreaterThanOrEqual(dimensions.trackLeft);
      expect(dimensions.lastRight).toBeLessThanOrEqual(dimensions.trackRight);
    }
  } else {
    await page.setViewportSize({ width: 720, height: 900 });
    expect(await page.locator(".event-grid").evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    )).toBe(2);
  }
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
