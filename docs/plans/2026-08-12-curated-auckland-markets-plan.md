# Curated Auckland Markets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate KiwiCue's Markets category with a zero-cost, verified Auckland market directory that reuses search, date and venue filters, internal details, maps, distance, bookmarks, and bilingual UI.

**Architecture:** A server-only curated adapter owns immutable organiser-sourced schedules and generates each market's next Auckland occurrence without runtime scraping. The public events API routes only `category=markets` to this bounded adapter; Ticketmaster retains all other categories and its existing cursor. Optional source and Chinese localization metadata travel through the shared KiwiCue event model so current cards, details, bookmarks, and saved pages remain reusable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, `@js-temporal/polyfill`, Vitest, Testing Library, Playwright, CSS modules already imported through `app/globals.css`.

## Global Constraints

- No Eventfinda API content, runtime scraping, paid service, dependency, API key, or environment variable.
- Use only basic schedule facts from official organiser pages; summaries are original KiwiCue copy and images remain `null`.
- Preserve every Ticketmaster route, cursor, secret, filter, and error behavior outside `category=markets`.
- Validate all public input through existing parsers; official links are fixed HTTPS constants.
- TypeScript contains no `any`; production code contains no `console.log`, placeholder, dead code, or empty catch.
- Mobile-first at 375px; controls retain 44px minimum targets, focus visibility, reduced motion, and no horizontal overflow.
- `skills-lock.json`, `.env*`, screenshots, secrets, and unrelated user changes are never staged.
- Every behavior change follows red-green-refactor and each focused task receives a commit.

---

## File map

- Create `lib/curated-markets.ts`: immutable source registry, recurrence calculation, filtering, list/detail normalization, venue catalogue.
- Create `tests/curated-markets.test.ts`: recurrence, filtering, freshness, source, URL, localization, list and detail contracts.
- Modify `lib/events.ts`: optional source and localized metadata shared by curated list/detail/bookmarks.
- Modify `lib/event-display.ts`: localized event-name, description, note, status and verification-date helpers.
- Modify `app/api/events/route.ts`: route Markets requests to the curated loader.
- Modify `app/api/events/[eventId]/route.ts`: route reserved curated IDs to local details.
- Modify `lib/venue-catalog.ts`: combine curated and Ticketmaster venue catalogues with safe fallback.
- Modify `lib/cached-event-suggestions.ts`: use curated suggestions for Markets without Ticketmaster quota.
- Modify `app/events/event-card.tsx`: render localized curated names and status.
- Modify `app/events/event-explorer.tsx`: truthful curated counts, completion, source and empty copy.
- Modify `components/events-page-content.tsx`: truthful Markets source strip.
- Modify `components/event-detail-content.tsx`: localized curated description, visit instructions, source and verification details.
- Modify `lib/bookmarks.ts`, `components/bookmark-button.tsx`, `components/saved-page-content.tsx`: preserve and display safe curated metadata.
- Modify focused tests under `tests/` and `e2e/portal-interactions.spec.ts`.

---

### Task 1: Curated market model and recurrence adapter

**Files:**
- Create: `lib/curated-markets.ts`
- Create: `tests/curated-markets.test.ts`
- Modify: `lib/events.ts`

**Interfaces:**
- Produces `EventSource`, `EventLocalization`, and optional `source`/`localization` fields on `KiwiCueEvent`.
- Produces `listCuratedMarkets(options): AucklandEventsResult`, `findCuratedMarketDetail(eventId, now): KiwiCueEventDetail | null`, `listCuratedMarketVenues(): AucklandVenue[]`, and `isCuratedMarketId(eventId): boolean`.
- Consumes `EventWindow` and `resolveEventWindow` from the existing date system.

- [ ] **Step 1: Write failing domain and recurrence tests**

```ts
import { describe, expect, it } from "vitest";
import {
  findCuratedMarketDetail,
  listCuratedMarkets,
  listCuratedMarketVenues,
} from "../lib/curated-markets";

const beforeSunday = new Date("2026-08-15T22:00:00.000Z"); // Sun 10:00 NZST

describe("curated Auckland markets", () => {
  it("returns each market once at its next Auckland occurrence", () => {
    const result = listCuratedMarkets({ now: beforeSunday, window: "all", size: 50 });
    expect(result.events.length).toBeGreaterThanOrEqual(10);
    expect(new Set(result.events.map((event) => event.id)).size).toBe(result.events.length);
    expect(result.events.every((event) => event.category === "Market")).toBe(true);
    expect(result.nextCursor).toBeNull();
  });

  it("moves a same-day market to next week after its opening time", () => {
    const before = findCuratedMarketDetail("kc-market-grey-lynn", new Date("2026-08-15T20:00:00Z"));
    const after = findCuratedMarketDetail("kc-market-grey-lynn", new Date("2026-08-16T01:00:00Z"));
    expect(before?.start.localDate).toBe("2026-08-16");
    expect(after?.start.localDate).toBe("2026-08-23");
  });

  it("filters by normalized keyword, venue and existing date windows", () => {
    expect(listCuratedMarkets({ now: beforeSunday, window: "all", keyword: "grey lynn", size: 50 }).events)
      .toHaveLength(1);
    const venue = listCuratedMarketVenues().find((item) => item.id === "kc-venue-grey-lynn");
    expect(venue).toBeDefined();
    expect(listCuratedMarkets({ now: beforeSunday, window: "7d", venueId: venue?.id, size: 50 }).events)
      .toHaveLength(1);
  });

  it("keeps official HTTPS sources, bilingual copy and recent verification dates", () => {
    const event = findCuratedMarketDetail("kc-market-grey-lynn", beforeSunday);
    expect(event?.source?.url).toMatch(/^https:\/\//);
    expect(event?.source?.verifiedAt).toBe("2026-08-12");
    expect(event?.localization?.zh?.name).toBeTruthy();
    expect(event?.localization?.zh?.description).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/curated-markets.test.ts --maxWorkers=1`

Expected: FAIL because `lib/curated-markets.ts` and the optional metadata types do not exist.

- [ ] **Step 3: Add the shared optional metadata types**

```ts
export interface EventSource {
  name: string;
  url: string;
  verifiedAt: string;
}

export interface EventLocalization {
  zh?: {
    name?: string;
    description?: string;
    note?: string;
  };
}

export interface KiwiCueEvent {
  // existing fields remain unchanged
  source?: EventSource;
  localization?: EventLocalization;
}
```

- [ ] **Step 4: Implement immutable definitions and the bounded adapter**

```ts
import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { resolveEventWindow, type EventWindow } from "./event-window";
import type { AucklandEventsResult, AucklandVenue, KiwiCueEventDetail } from "./events";

const TIME_ZONE = "Pacific/Auckland";
const CURATED_PREFIX = "kc-market-";

export type CuratedMarketOptions = {
  now?: Date;
  size?: number;
  window?: EventWindow;
  keyword?: string | null;
  venueId?: string | null;
};

export function isCuratedMarketId(eventId: string): boolean {
  return eventId.startsWith(CURATED_PREFIX);
}

export function listCuratedMarkets(options: CuratedMarketOptions = {}): AucklandEventsResult {
  const events = buildNextOccurrences(options.now ?? new Date())
    .filter((event) => matchesWindow(event, options.window ?? "all", options.now ?? new Date()))
    .filter((event) => matchesKeyword(event, options.keyword))
    .filter((event) => !options.venueId || event.venue?.id === options.venueId)
    .sort(compareEvents)
    .slice(0, clampSize(options.size));
  return {
    events,
    page: { size: clampSize(options.size), totalElements: events.length, totalPages: events.length ? 1 : 0, number: 0 },
    nextCursor: null,
  };
}
```

Definitions include the four approved official source URLs, ten or more stable series, original bilingual copy, `verifiedAt: "2026-08-12"`, and `imageUrl: null`. `buildNextOccurrences` uses `Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(TIME_ZONE)` and weekday deltas, then emits a real instant from the target `Temporal.ZonedDateTime`.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx vitest run tests/curated-markets.test.ts --maxWorkers=1`

Expected: PASS with at least ten unique next-occurrence records.

- [ ] **Step 6: Commit the adapter**

```powershell
git add -- lib/events.ts lib/curated-markets.ts tests/curated-markets.test.ts
git commit -m "feat: add curated Auckland market schedules"
```

---

### Task 2: Route lists, details, venues, and suggestions by source

**Files:**
- Modify: `app/api/events/route.ts`
- Modify: `app/api/events/[eventId]/route.ts`
- Modify: `lib/venue-catalog.ts`
- Modify: `lib/cached-event-suggestions.ts`
- Modify: `tests/events-route.test.ts`
- Modify: `tests/event-detail-route.test.ts`
- Modify: `tests/venue-catalog.test.ts`
- Modify: `tests/event-suggestions.test.ts`

**Interfaces:**
- Consumes Task 1 exports.
- Preserves the existing Ticketmaster loader as the second positional argument to `handleEventsRequest`.
- Adds a third injected curated loader for focused route tests.
- Produces `collectCombinedAucklandVenues()` for the venue route.

- [ ] **Step 1: Write failing route and catalogue tests**

```ts
it("routes Markets to curated data without calling Ticketmaster", async () => {
  const ticketmaster = vi.fn();
  const curated = vi.fn().mockResolvedValue(marketResult);
  const response = await handleEventsRequest(
    new Request("http://localhost/api/events?category=markets&q=grey&window=7d"),
    ticketmaster,
    curated,
  );
  expect(ticketmaster).not.toHaveBeenCalled();
  expect(curated).toHaveBeenCalledWith({ size: undefined, keyword: "grey", window: "7d" });
  expect(response.status).toBe(200);
});

it("loads a reserved curated detail locally", async () => {
  const ticketmaster = vi.fn();
  const curated = vi.fn().mockReturnValue(marketDetail);
  const response = await handleEventDetailRequest("kc-market-grey-lynn", ticketmaster, curated);
  expect(ticketmaster).not.toHaveBeenCalled();
  expect((await response.json()).event).toEqual(marketDetail);
});
```

Venue tests assert curated venues survive a Ticketmaster error and duplicate IDs are removed. Suggestion tests assert `category=markets` returns curated names without calling the Ticketmaster catalogue.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/events-route.test.ts tests/event-detail-route.test.ts tests/venue-catalog.test.ts tests/event-suggestions.test.ts --maxWorkers=1`

Expected: FAIL because source routing and combined venues do not exist.

- [ ] **Step 3: Implement list and detail source routing**

```ts
export async function handleEventsRequest(
  request: Request,
  loadEvents: LoadEvents = fetchAucklandEventFeed,
  loadMarkets: LoadCuratedMarkets = listCuratedMarkets,
): Promise<Response> {
  // keep existing parsing
  const payload = category === "markets"
    ? loadMarkets({ size, keyword, venueId, ...(window !== "all" ? { window } : {}) })
    : loadEvents({ size, ...(category ? { category } : {}), /* existing filters */ });
  // keep existing safe response mapping
}
```

`handleEventDetailRequest` checks `isCuratedMarketId(validEventId)`, calls the injected local finder, returns the existing safe 404 when it is `null`, and otherwise keeps the Ticketmaster branch unchanged.

- [ ] **Step 4: Implement combined venues and curated suggestions**

```ts
export async function collectCombinedAucklandVenues(): Promise<AucklandVenue[]> {
  const curated = listCuratedMarketVenues();
  let ticketmaster: AucklandVenue[] = [];
  try {
    ticketmaster = await collectAucklandVenues();
  } catch (error) {
    if (!(error instanceof TicketmasterClientError)) throw error;
  }
  return mergeVenues(ticketmaster, curated);
}
```

`loadEventNameSuggestions` selects `listCuratedMarkets({ window, keyword: query, venueId, size: limit })` when `category === "markets"`; all other categories retain `loadCachedCatalog`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/events-route.test.ts tests/event-detail-route.test.ts tests/venue-catalog.test.ts tests/event-suggestions.test.ts --maxWorkers=1`

Expected: PASS with the new routing and fallback assertions.

- [ ] **Step 6: Commit server routing**

```powershell
git add -- app/api/events/route.ts 'app/api/events/[eventId]/route.ts' lib/venue-catalog.ts lib/cached-event-suggestions.ts tests/events-route.test.ts tests/event-detail-route.test.ts tests/venue-catalog.test.ts tests/event-suggestions.test.ts
git commit -m "feat: route market discovery through curated data"
```

---

### Task 3: Truthful bilingual market cards, counts, and source strip

**Files:**
- Modify: `lib/event-display.ts`
- Modify: `app/events/event-card.tsx`
- Modify: `app/events/event-explorer.tsx`
- Modify: `components/events-page-content.tsx`
- Modify: `tests/event-card.test.tsx`
- Modify: `tests/event-explorer.test.tsx`
- Modify: `tests/bilingual-pages.test.tsx`

**Interfaces:**
- Consumes optional `localization.zh.name` and curated status `schedule_verified`.
- Produces `eventDisplayName(event, language): string` and market-aware copy selected by `category === "markets"`.

- [ ] **Step 1: Write failing localized-card and source-copy tests**

```tsx
it("shows the curated Chinese name and verified schedule status", () => {
  render(<EventCard event={curatedMarket} index={0} language="zh" />);
  expect(screen.getByRole("heading", { name: "灰林农夫市集" })).toBeVisible();
  expect(screen.getByText("日程已核实")).toBeVisible();
});

it("uses curated counts instead of Ticketmaster claims", async () => {
  render(<EventExplorer category="markets" requestEvents={vi.fn().mockResolvedValue(marketResult)} />);
  expect(await screen.findByText("10 verified market schedules · 10 shown")).toBeVisible();
  expect(screen.queryByText(/Ticketmaster/)).not.toBeInTheDocument();
});
```

Page tests assert the source strip switches to `KiwiCue verified schedules` and `KiwiCue 已核实日程` only for Markets.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/event-card.test.tsx tests/event-explorer.test.tsx tests/bilingual-pages.test.tsx --maxWorkers=1`

Expected: FAIL because cards and page copy always use raw names and Ticketmaster wording.

- [ ] **Step 3: Implement display helpers and market-aware copy**

```ts
export function eventDisplayName(event: KiwiCueEvent, language: Language): string {
  return language === "zh" && event.localization?.zh?.name
    ? event.localization.zh.name
    : event.name;
}

// status map additions
schedule_verified: "Schedule verified";
schedule_verified: "日程已核实";
```

`EventCard` uses the display name for heading and accessible labels. `EventExplorer` and `EventsPageContent` select market-specific count, completion, disclaimer, and source-strip copy from the active category while leaving other category assertions unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npx vitest run tests/event-card.test.tsx tests/event-explorer.test.tsx tests/bilingual-pages.test.tsx --maxWorkers=1`

Expected: PASS in English and Chinese.

- [ ] **Step 5: Commit list UI**

```powershell
git add -- lib/event-display.ts app/events/event-card.tsx app/events/event-explorer.tsx components/events-page-content.tsx tests/event-card.test.tsx tests/event-explorer.test.tsx tests/bilingual-pages.test.tsx
git commit -m "feat: present verified markets in both languages"
```

---

### Task 4: Curated detail, source freshness, and bookmark preservation

**Files:**
- Modify: `components/event-detail-content.tsx`
- Modify: `components/bookmark-button.tsx`
- Modify: `components/saved-page-content.tsx`
- Modify: `lib/bookmarks.ts`
- Modify: `app/styles/detail-saved.css`
- Modify: `tests/event-detail-content.test.tsx`
- Modify: `tests/bookmarks.test.ts`
- Modify: `tests/saved-page-content.test.tsx`

**Interfaces:**
- Consumes `source`, `localization`, and `eventDisplayName` from Tasks 1 and 3.
- Preserves valid optional metadata in bookmark version 1 without rejecting legacy records.

- [ ] **Step 1: Write failing detail and bookmark tests**

```tsx
it("shows localized visit guidance and verified official source", async () => {
  renderCuratedDetail(curatedDetail);
  fireEvent.click(await screen.findByRole("button", { name: "切换到中文" }));
  expect(screen.getByRole("heading", { name: "出发前确认" })).toBeVisible();
  expect(screen.getByText(curatedDetail.localization!.zh!.description!)).toBeVisible();
  expect(screen.getByText("核实日期：2026年8月12日")).toBeVisible();
  expect(screen.getByRole("link", { name: "查看官方最新安排" })).toHaveAttribute(
    "href",
    curatedDetail.source!.url,
  );
});

it("round trips valid curated source and localization metadata", () => {
  const serialized = serializeBookmarks([toBookmark(curatedEvent, "2026-08-12T00:00:00Z")]);
  expect(parseBookmarks(serialized)[0].event.source).toEqual(curatedEvent.source);
  expect(parseBookmarks(serialized)[0].event.localization).toEqual(curatedEvent.localization);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx vitest run tests/event-detail-content.test.tsx tests/bookmarks.test.ts tests/saved-page-content.test.tsx --maxWorkers=1`

Expected: FAIL because the detail has ticket wording and bookmark parsing drops the optional metadata.

- [ ] **Step 3: Implement safe optional metadata parsing**

```ts
function parseSource(value: unknown): EventSource | undefined {
  if (!isRecord(value)) return undefined;
  if (!boundedString(value.name, 200) || !safeHttpsUrl(value.url) || !validLocalDate(value.verifiedAt)) {
    return undefined;
  }
  return { name: value.name.trim(), url: value.url, verifiedAt: value.verifiedAt };
}
```

Localization parsing accepts only the `zh` object and length-bounded optional strings. Malformed optional metadata is discarded while a valid base bookmark remains usable.

- [ ] **Step 4: Implement source-aware detail copy and layout**

```tsx
const isCurated = Boolean(event.source);
const description = language === "zh"
  ? event.localization?.zh?.description ?? event.description
  : event.description;
const officialHref = event.source?.url ?? event.url;
```

For curated records, the heading becomes `Plan your visit` / `出发前确认`, the primary action becomes `Check official schedule` / `查看官方最新安排`, and a source block shows organiser plus `verifiedAt`. Ticketmaster records keep all existing booking copy. Reuse the current 8px/12px radius tokens and separators; do not introduce a nested card.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npx vitest run tests/event-detail-content.test.tsx tests/bookmarks.test.ts tests/saved-page-content.test.tsx --maxWorkers=1`

Expected: PASS with safe links and bilingual content.

- [ ] **Step 6: Commit details and bookmarks**

```powershell
git add -- components/event-detail-content.tsx components/bookmark-button.tsx components/saved-page-content.tsx lib/bookmarks.ts app/styles/detail-saved.css tests/event-detail-content.test.tsx tests/bookmarks.test.ts tests/saved-page-content.test.tsx
git commit -m "feat: add trusted market details and saved metadata"
```

---

### Task 5: Browser journeys and responsive verification

**Files:**
- Modify: `e2e/portal-interactions.spec.ts`
- Modify if a verified defect is found: `app/styles/events.css`, `app/styles/responsive.css`, `app/styles/detail-saved.css`

**Interfaces:**
- Consumes the complete public Markets flow.
- Produces browser evidence for 375px and 1440px, bilingual search, detail, map/distance fallback, and bookmark behavior.

- [ ] **Step 1: Add failing Playwright coverage**

```ts
test("curated markets remain searchable and usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/events?category=markets");
  await expect(page.getByRole("heading", { name: /market/i }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", 375);
  await page.getByLabel("Activity name").fill("Grey Lynn");
  await page.getByRole("button", { name: "Search events" }).click();
  await page.getByRole("link", { name: /Grey Lynn Farmers Market details/ }).click();
  await expect(page.getByText(/Verified/)).toBeVisible();
  await page.getByRole("button", { name: /Save/ }).click();
});
```

The desktop case uses 1440px, selects a curated venue, switches to Chinese, and verifies no horizontal overflow. The test accepts either a rendered map and distance control or the localized coordinate-unavailable explanation.

- [ ] **Step 2: Run the Markets Playwright case and verify RED**

Run: `npm run test:e2e -- --grep "curated markets"`

Expected: FAIL before the completed UI is available.

- [ ] **Step 3: Fix only browser-confirmed responsive or accessibility defects**

Use the existing selectors and tokens. Any CSS edit is tied to a failing assertion, for example:

```css
@media (max-width: 600px) {
  .event-source-verification {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run the focused Playwright case and verify GREEN**

Run: `npm run test:e2e -- --grep "curated markets"`

Expected: PASS at 375px and 1440px.

- [ ] **Step 5: Commit browser coverage**

```powershell
git add -- e2e/portal-interactions.spec.ts app/styles/events.css app/styles/responsive.css app/styles/detail-saved.css
git commit -m "test: cover curated market journeys"
```

---

### Task 6: Full verification, review, PR, merge, and issue completion

**Files:**
- Modify only when a full check exposes a real defect.
- Do not stage: `skills-lock.json`.

**Interfaces:**
- Produces release evidence and the merged GitHub state required by issue `#51`.

- [ ] **Step 1: Run the complete local verification matrix**

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm run test:e2e
git diff --check main...HEAD
```

Expected: every command exits `0`; Vitest, Node tests, and Playwright report zero failures; build completes; diff check prints no errors.

- [ ] **Step 2: Audit the implementation against every design requirement**

Check:

```powershell
rg -n "Eventfinda|T[D]O|F[I]XME|console\.log|NEXT_PUBLIC_" lib app components tests e2e
git status --short
git diff --stat main...HEAD
```

Expected: no production Eventfinda ingestion, placeholder, debug logging, or new public secret; only intentional files differ; `skills-lock.json` remains untracked and unstaged.

- [ ] **Step 3: Request a code review and resolve every important finding**

Review scope: recurrence correctness, Auckland timezone, source/legal boundaries, pagination truthfulness, route fallback, input validation, bilingual UI, bookmark safety, accessibility, and mobile overflow. Re-run the full verification matrix after fixes.

- [ ] **Step 4: Push the feat branch and create a ready PR**

```powershell
git push -u origin feat/curated-auckland-markets
gh pr create --base main --head feat/curated-auckland-markets --title "Add verified Auckland market discovery" --body "Closes #51"
```

Expected: GitHub returns a PR URL and links issue `#51`.

- [ ] **Step 5: Merge only after checks pass**

```powershell
gh pr checks --watch
gh pr merge --merge --delete-branch
gh issue view 51 --json state,assignees
```

Expected: PR is merged, issue `#51` is closed, assignee is `hannnnnnnny`, and `origin/main` contains the feature commits.

- [ ] **Step 6: Confirm the final local and remote state**

```powershell
git switch main
git pull --ff-only
git status --short --branch
git log -5 --oneline --decorate
```

Expected: local `main` matches `origin/main`; only the pre-existing untracked `skills-lock.json` remains.
