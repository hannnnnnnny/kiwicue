import { expect, test, type Page, type Route } from "@playwright/test";

type RouteOptions = {
  initialFailures?: number;
  appendFailures?: number;
  venueFailure?: boolean;
  appendRelease?: Promise<void>;
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

const curatedMarkets = [
  {
    ...event("kc-market-kelston", "Auckland Night Markets – Kelston"),
    url: "https://www.aucklandnightmarkets.co.nz/",
    status: "schedule_verified",
    category: "Market",
    venue: {
      id: "kc-venue-kelston",
      name: "Kelston Mall",
      city: "Auckland",
      address: "2 West Coast Road, Kelston",
      postalCode: "0602",
      coordinates: { latitude: -36.9086, longitude: 174.6636 },
    },
    source: {
      name: "Auckland Night Markets",
      url: "https://www.aucklandnightmarkets.co.nz/",
      verifiedAt: "2026-08-12",
    },
    localization: { zh: { name: "奥克兰夜市 · Kelston" } },
  },
  {
    ...event("kc-market-grey-lynn", "Grey Lynn Farmers Market"),
    url: "https://www.greylynnfarmersmarket.co.nz/",
    status: "schedule_verified",
    category: "Market",
    venue: {
      id: "kc-venue-grey-lynn",
      name: "Grey Lynn Community Centre",
      city: "Auckland",
      address: "510 Richmond Road, Grey Lynn",
      postalCode: "1021",
      coordinates: { latitude: -36.8574, longitude: 174.7282 },
    },
    source: {
      name: "Grey Lynn Farmers Market",
      url: "https://www.greylynnfarmersmarket.co.nz/",
      verifiedAt: "2026-08-12",
    },
    localization: {
      zh: {
        name: "Grey Lynn 农夫市集",
        description: "社区农夫市集，有本地农产品和现场食物。",
        note: "公共假期前后日程可能调整。",
        previewSummary: "由社区运营，可以直接向本地种植者购买。",
        previewHighlights: ["本地当季农产品", "社区食品商家", "减少废弃物"],
        previewImageAlt: "Grey Lynn 农夫市集里的新鲜农产品",
      },
    },
    editorialPreview: {
      summary: "A community market where local growers sell directly.",
      highlights: [
        "Seasonal local produce",
        "Small neighbourhood food makers",
        "A strong low-waste focus",
      ],
      image: {
        url: "https://images.example/grey-lynn.gif",
        alt: "Fresh produce at Grey Lynn Farmers Market",
        sourceName: "Grey Lynn Farmers Market",
        sourceUrl: "https://www.greylynnfarmersmarket.co.nz/",
        verifiedAt: "2026-08-12",
      },
    },
  },
];

const curatedMarketDetail = {
  ...curatedMarkets[1],
  description: "A neighbourhood farmers market with local produce and prepared food.",
  note: "Schedules can change around public holidays.",
};

const movieScreening = {
  id: "screening-1",
  filmId: "film-1",
  filmTitle: "Whina",
  filmRating: "M",
  runtimeMinutes: 112,
  cinemaId: "academy",
  cinemaName: "Academy Cinemas",
  startTime: "2026-08-15T18:30:00+12:00",
  formats: ["2D", "English subtitles"],
  soldOut: false,
  distanceKilometres: 1.4,
  bookingUrl: "https://tickets.example/whina",
};

const moviePreview = {
  id: 550,
  title: "Fight Club",
  originalTitle: null,
  overview: "An insomniac meets a soap maker and forms an underground club.",
  posterUrl: "https://image.tmdb.org/t/p/w500/fight-club.jpg",
  releaseDate: "1999-10-15",
  rating: 8.4,
  ratingCount: 31_000,
};

const moviePreviewDetail = {
  ...moviePreview,
  runtimeMinutes: 139,
  genres: ["Drama", "Thriller"],
  certification: "R16",
  trailerKey: "Abc_123-x",
  tmdbUrl: "https://www.themoviedb.org/movie/550",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installRoutes(page: Page, options: RouteOptions = {}) {
  const eventRequests: string[] = [];
  const venueRequests: string[] = [];
  const movieRequests: string[] = [];
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
    await page.route("https://image.tmdb.org/**", (route) => route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: transparentGif,
    }));
    await page.route("https://www.themoviedb.org/assets/**", (route) => route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#0d253f"/></svg>',
    }));
    await page.route("https://www.youtube-nocookie.com/**", (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Trailer fixture</title>",
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
        { id: "kc-venue-grey-lynn", name: "Grey Lynn Community Centre" },
        { id: "kc-venue-kelston", name: "Kelston Mall" },
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
    if (url.pathname.endsWith("/api/events/kc-market-grey-lynn")) {
      return json(route, { event: curatedMarketDetail });
    }
    eventRequests.push(requestUrl);
    if (url.searchParams.has("cursor")) {
      if (options.appendRelease) await options.appendRelease;
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
    if (url.searchParams.get("category") === "markets") {
      const query = url.searchParams.get("q")?.toLocaleLowerCase("en-NZ") ?? "";
      const venueId = url.searchParams.get("venue");
      const markets = curatedMarkets.filter((market) =>
        (!query || market.name.toLocaleLowerCase("en-NZ").includes(query))
        && (!venueId || market.venue.id === venueId),
      );
      return json(route, {
        events: markets,
        page: { size: 50, totalElements: markets.length, totalPages: markets.length ? 1 : 0, number: 0 },
        nextCursor: null,
      });
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
  await page.route("**/api/movies**", async (route) => {
    const requestUrl = route.request().url();
    const url = new URL(requestUrl);
    movieRequests.push(requestUrl);
    if (url.searchParams.get("q") === "Offline") {
      return json(route, { screenings: [], source: "open-cinema", sourceState: "unavailable" });
    }
    if (url.searchParams.get("q") === "NoFilm") {
      return json(route, { screenings: [], source: "open-cinema", sourceState: "empty" });
    }
    return json(route, { screenings: [movieScreening], source: "open-cinema", sourceState: "ready" });
  });
  await page.route("**/api/movie-previews**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/api/movie-previews/550")) {
      return json(route, { movie: moviePreviewDetail });
    }
    if (url.searchParams.get("q") === "NoFilm") {
      return json(route, { movies: [], page: { number: 1, totalPages: 0, totalResults: 0 } });
    }
    return json(route, { movies: [moviePreview], page: { number: 1, totalPages: 1, totalResults: 1 } });
  });

  return { eventRequests, venueRequests, movieRequests };
}

async function resetApiRoutes(page: Page) {
  await page.unroute("**/api/venues**");
  await page.unroute("**/api/events**");
  await page.unroute("**/api/movies**");
  await page.unroute("**/api/movie-previews**");
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

test("opens a named, touchable, overflow-safe home and event discovery journey", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page);
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Find something worth leaving home for." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/home-${testInfo.project.name}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "Skip to Auckland guide" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/#home-content$/);
  await page.getByRole("link", { name: /Browse Auckland events/ }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole("heading", { name: "Find your next Auckland plan." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/events-list-${testInfo.project.name}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "KiwiCue Auckland events home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: /Browse Auckland events/ }).click();
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
  expect(columns).toBe(testInfo.project.name === "mobile-375" ? 1 : 2);
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === "desktop") {
    const timeRange = page.getByRole("navigation", { name: "Event time range" });
    const allFuture = page.getByRole("link", { name: "All future", exact: true });
    const filterIsFullyVisible = await Promise.all([timeRange.boundingBox(), allFuture.boundingBox()])
      .then(([track, link]) => Boolean(
        track
        && link
        && link.x >= track.x
        && link.x + link.width <= track.x + track.width,
      ));
    expect(filterIsFullyVisible).toBe(true);

    const category = page.getByRole("link", { name: "Concerts", exact: true });
    await category.hover();
    await expect.poll(() => category.evaluate((element) => getComputedStyle(element).color))
      .toBe("rgb(20, 108, 91)");
    const box = await category.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
    await page.mouse.down();
    expect(await category.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
    await page.mouse.move(0, 0);
    await page.mouse.up();
  }

  const counts = { events: requests.eventRequests.length, venues: requests.venueRequests.length };
  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "找到下一场奥克兰活动。" })).toBeVisible();
  await page.locator(".language-toggle").click();
  await expect(page.getByRole("heading", { name: "Find your next Auckland plan." })).toBeVisible();
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
  await tabTo(page, page.getByRole("link", { name: "Movies", exact: true }));
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
    await page.goto("/events?category=markets&q=Grey&venue=kc-venue-grey-lynn");
    await expect(page.getByRole("heading", { name: "Grey Lynn Farmers Market" })).toBeVisible();
    const before = requests.eventRequests.length;
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`window=${value}&category=markets&q=Grey&venue=kc-venue-grey-lynn$`));
    await expect.poll(() => requests.eventRequests.length).toBeGreaterThan(before);
  }
  await page.goto("/events?window=weekend&category=markets&q=Grey&venue=kc-venue-grey-lynn");
  await page.getByRole("link", { name: "All future", exact: true }).click();
  await expect(page).toHaveURL(/\/events\?category=markets&q=Grey&venue=kc-venue-grey-lynn$/);
  expect(errors).toEqual([]);
});

test("load more de-duplicates and the event detail opens a noopener official booking tab", async ({ page }) => {
  const errors = runtimeErrors(page);
  let releaseAppend!: () => void;
  const appendRelease = new Promise<void>((resolve) => { releaseAppend = resolve; });
  const requests = await installRoutes(page, { appendRelease });
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
  releaseAppend();
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

test("curated markets can be filtered, opened, mapped, saved, and read in Chinese", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {
              latitude: -36.8509, longitude: 174.7645, accuracy: 10,
              altitude: null, altitudeAccuracy: null, heading: null, speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });
  await page.context().route("https://www.greylynnfarmersmarket.co.nz/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Grey Lynn Farmers Market</title>",
  }));

  await page.goto("/events?category=markets");
  await expect(page.getByText("2 verified market schedules · 2 shown")).toBeVisible();
  await expect(page.getByText("Verified official market links")).toHaveCount(1);
  await expect(page.locator(".source-disclaimer")).not.toContainText("Ticketmaster");

  await page.getByLabel("Activity name").fill("Grey");
  await page.getByLabel("Venue").selectOption("kc-venue-grey-lynn");
  await page.getByRole("button", { name: "Search events" }).click();
  await expect(page).toHaveURL(/category=markets&q=Grey&venue=kc-venue-grey-lynn$/);
  await expect(page.getByRole("heading", { name: "Grey Lynn Farmers Market" })).toBeVisible();
  await expect(page.getByText("AKL", { exact: true })).toHaveCount(0);
  await expect(page.locator('img[src="https://images.example/grey-lynn.gif"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/market-list-${testInfo.project.name}.png`, fullPage: true });
  }

  await page.getByRole("link", { name: "View Grey Lynn Farmers Market details" }).click();
  await expect(page.getByRole("heading", { name: "Plan your visit" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Past highlights" })).toBeVisible();
  await expect(page.getByText("Seasonal local produce")).toBeVisible();
  const pastPreviewLink = page.getByRole("link", { name: "Open official past preview" });
  await expect(pastPreviewLink).toBeVisible();
  expect((await pastPreviewLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByText(/Schedule last checked.*12 Aug 2026/)).toBeVisible();
  await expect(page.getByTitle("Map of Grey Lynn Community Centre")).toBeVisible();
  await page.getByRole("button", { name: "Show distance from me" }).click();
  await expect(page.getByText(/^About .* km away/)).toBeVisible();
  await page.getByRole("button", { name: "Save Grey Lynn Farmers Market" }).click();
  await expect(page.getByRole("link", { name: "Saved events, 1" })).toBeVisible();

  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Grey Lynn 农夫市集" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "出发前确认" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "往期精选" })).toBeVisible();
  await expect(page.getByText("本地当季农产品")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看官方最新安排" })).toBeVisible();
  await expect(page.getByRole("button", { name: "从收藏中移除 Grey Lynn 农夫市集" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/market-detail-${testInfo.project.name}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("a failed official market image becomes a useful text preview", async ({ page }) => {
  await installRoutes(page);
  await page.route("https://images.example/grey-lynn.gif", (route) => route.abort("failed"));

  await page.goto("/events?category=markets&q=Grey");

  await expect(page.getByText("What to expect")).toBeVisible();
  await expect(page.getByText("A community market where local growers sell directly.")).toBeVisible();
  await expect(page.getByText("AKL", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
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

test("movie search, dates, distance, language, maps, and official links work without overflow", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  const requests = await installRoutes(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {
              latitude: -36.8514, longitude: 174.7654, accuracy: 10,
              altitude: null, altitudeAccuracy: null, heading: null, speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });
  await page.context().route("https://tickets.example/**", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><title>Official movie booking</title>",
  }));
  await page.context().route("https://academycinemas.co.nz/**", (route) => route.fulfill({
    status: 200, contentType: "text/html", body: "<!doctype html><title>Academy sessions</title>",
  }));

  await page.goto("/movies");
  await expect(page.getByRole("heading", { name: "Find films and verified Auckland sessions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Whina" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Movies" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalOverflow(page);

  const targets = page.locator([
    ".portal-header-link", ".language-toggle", ".movie-search-field input", ".movie-search-submit",
    ".movie-search-clear", ".movie-date-filter button", ".cinema-tools button", ".movie-session-action a",
    ".cinema-directory-actions a",
  ].join(","));
  for (let index = 0; index < await targets.count(); index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  const input = page.getByLabel("Movie, cinema, or suburb");
  await input.fill("  NoFilm  ");
  await page.getByRole("button", { name: "Search movies" }).click();
  await expect(page.getByText("No open-feed sessions found")).toBeVisible();
  await expect(page).toHaveURL(/\/movies\?q=NoFilm$/);
  expect(requests.movieRequests.at(-1)).toContain("q=NoFilm&date=today");

  for (const [label, value] of [["Tomorrow", "tomorrow"], ["This weekend", "weekend"], ["All upcoming", "all"], ["Today", "today"]] as const) {
    await page.getByRole("button", { name: label }).click();
    await expect.poll(() => new URL(requests.movieRequests.at(-1) ?? "http://invalid").searchParams.get("date")).toBe(value);
  }

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("heading", { name: "Whina" })).toBeVisible();
  await page.getByRole("button", { name: "Sort cinemas by my distance" }).click();
  await expect(page.getByText("0.0 km away")).toBeVisible();

  const sessionLink = page.getByRole("link", { name: "Book on official site" });
  await expect(sessionLink).toHaveAttribute("rel", /noopener/);
  const [bookingPopup] = await Promise.all([page.waitForEvent("popup"), sessionLink.click()]);
  await expect(bookingPopup).toHaveURL("https://tickets.example/whina");
  expect(await bookingPopup.evaluate(() => window.opener === null)).toBe(true);
  await bookingPopup.close();

  const cinemaLink = page.getByRole("link", { name: "Academy Cinemas sessions" });
  const [cinemaPopup] = await Promise.all([page.waitForEvent("popup"), cinemaLink.click()]);
  await expect(cinemaPopup).toHaveURL("https://academycinemas.co.nz/");
  await cinemaPopup.close();
  await expect(page.getByRole("link", { name: "Map for Academy Cinemas" })).toHaveAttribute("href", /openstreetmap\.org/);

  const callsBeforeLanguage = requests.movieRequests.length;
  await page.getByRole("button", { name: "切换到中文" }).click();
  await expect(page.getByRole("heading", { name: "查找电影与已验证的奥克兰场次" })).toBeVisible();
  expect(requests.movieRequests).toHaveLength(callsBeforeLanguage);

  const columns = await page.locator(".cinema-directory-list").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns).toBe(testInfo.project.name === "desktop" ? 3 : testInfo.project.name === "tablet-768" ? 2 : 1);
  await expectNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});

test("movie cards open a complete in-site preview with a safe trailer", async ({ page }, testInfo) => {
  const errors = runtimeErrors(page);
  await installRoutes(page);
  await page.goto("/movies");

  const previewLink = page.getByRole("link", { name: "Preview Fight Club" });
  await expect(previewLink).toBeVisible();
  expect((await previewLink.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/movies-list-${testInfo.project.name}.png`, fullPage: true });
  }
  await previewLink.click();

  await expect(page).toHaveURL(/\/movies\/550$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fight Club" })).toBeVisible();
  await expect(page.getByText(moviePreview.overview)).toBeVisible();
  await expect(page.getByText("2 hr 19 min")).toBeVisible();
  await expect(page.getByText("R16")).toBeVisible();
  await expect(page.getByTitle("Fight Club official trailer")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/Abc_123-x",
  );
  await expect(page.getByRole("link", { name: "Open trailer on YouTube" })).toHaveAttribute("rel", /noopener/);
  await expect(page.getByRole("heading", { name: "Check Auckland cinema sessions" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/price|pricing|fees|NZ\$|价格|费用|票价/i);
  await expectNoHorizontalOverflow(page);
  if (process.env.CAPTURE_SCREENSHOTS === "1") {
    await page.screenshot({ path: `output/playwright/movie-detail-${testInfo.project.name}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
