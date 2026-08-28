# Events Discovery and Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace KiwiCue's rigid event feed with a truthful, bilingual, URL-backed editorial discovery page and a focused filtered-results mode.

**Architecture:** Keep the existing `/events` route and `/api/events` boundary, then derive editorial collections from normalized `KiwiCueEvent` records with pure functions. The client explorer owns cancellable cursor loading, while focused components render discovery, results, mobile filters, and complete states without manufacturing popularity or free-admission claims.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, vanilla CSS, Vitest, Testing Library, Playwright

## Global Constraints

- Preserve `Events → Picks → Movies → Saved`; do not add dead Guides or About routes.
- Keep `window`, `category`, `q`, and `venue` compatible; add only `sort=recommended|date`.
- Never label an event popular, trending, nearby, newly added, selling fast, free, or editorially selected without the approved evidence.
- Missing optional data is omitted; it is never replaced with fabricated copy.
- Saved events and language preference remain browser-local; do not request location for area discovery.
- Render third-party content as text and validate all query values and external URLs.
- Preserve English and Chinese UI, Auckland timezone semantics, reduced motion, and WCAG 2.2 AA behaviour.
- Support 375 px mobile, tablet, and desktop without horizontal page overflow.
- Add no UI framework, animation package, analytics, tracking, or external font request.
- Use test-driven red-green-refactor increments and keep `skills-lock.json` untracked.

---

## File Structure

- Create `tests/stubs/server-only.ts`: stable empty Vitest replacement for the framework marker package.
- Modify `vitest.config.ts`: alias `server-only` to the repository-owned stub.
- Modify `lib/events.ts`: optional verified admission, organiser, and KiwiCue area fields.
- Create `lib/event-discovery.ts`: pure scoring, Auckland date grouping, collection eligibility, de-duplication, and area mapping.
- Create `tests/event-discovery.test.ts`: exhaustive truth and determinism tests for discovery derivation.
- Modify `lib/event-search-url.ts`: typed sort state and canonical URL serialization.
- Modify `lib/event-search-params.ts`: bounded `sort` parser.
- Modify `app/events/page.tsx`: parse sort and pass the canonical state into the page.
- Modify `lib/ticketmaster.ts`: defensively normalize optional price and organiser metadata.
- Modify `tests/ticketmaster-client.test.ts`: verified admission/organiser normalization and rejection cases.
- Create `components/event-discovery-controls.tsx`: unified desktop controls, active chips, clear action, and mobile dialog trigger.
- Create `components/event-filter-dialog.tsx`: accessible full-screen mobile filter dialog.
- Create `components/event-lead-story.tsx`: one lead and two supporting editorial cards.
- Create `components/event-discovery-sections.tsx`: weekend, mood, category, picks, area, free, and chronological sections.
- Modify `components/events-page-content.tsx`: page hero, route mode, and simplified page shell.
- Modify `app/events/event-explorer.tsx`: cancellable request state, discovery/results rendering, sort, count wording, and cursor continuation.
- Modify `app/events/event-card.tsx`: reusable editorial card variants without black box borders.
- Modify `app/styles/events.css`: editorial event layout and component styling.
- Modify `app/styles/responsive.css`: 375 px, tablet, desktop, dialog, and reduced-motion behaviour.
- Modify existing event-page, explorer, search, card, navigation, theme, and accessibility tests to preserve contracts.
- Create `tests/events-editorial-theme.test.ts`: source-level checks for visual and responsive invariants.

### Task 1: Restore a trustworthy test baseline

**Files:**
- Create: `tests/stubs/server-only.ts`
- Modify: `vitest.config.ts`
- Test: all existing Vitest suites

**Interfaces:**
- Consumes: imports of the side-effect-only module `server-only`.
- Produces: a stable no-op test module resolved without relying on a private Next.js path.

- [ ] **Step 1: Write the repository-owned stub**

```ts
// tests/stubs/server-only.ts
export {};
```

- [ ] **Step 2: Point Vitest at the stub**

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

- [ ] **Step 3: Run the full baseline**

Run: `npm test`

Expected: all Vitest files collect, all existing assertions pass, and `tests/site.test.mjs` passes. If another failure remains, diagnose it before continuing rather than weakening the test.

- [ ] **Step 4: Commit the compatibility repair**

```bash
git add vitest.config.ts tests/stubs/server-only.ts
git commit -m "test: stabilize server-only module alias"
```

### Task 2: Add canonical sort state

**Files:**
- Modify: `lib/event-search-url.ts`
- Modify: `lib/event-search-params.ts`
- Modify: `app/events/page.tsx`
- Modify: `tests/event-search-url.test.ts`
- Modify: `tests/event-search-params.test.ts`

**Interfaces:**
- Consumes: `EventWindow`, `EventCategory`, existing query values.
- Produces: `EventSort = "recommended" | "date"`, `parseEventSort(value)`, and `EventSearchState.sort`.

- [ ] **Step 1: Write failing parser and URL tests**

```ts
import { parseEventSort } from "../lib/event-search-params";

it("accepts only supported event sorts", () => {
  expect(parseEventSort("date")).toBe("date");
  expect(parseEventSort("recommended")).toBe("recommended");
  expect(parseEventSort("popular")).toBe("recommended");
  expect(parseEventSort(["date"])).toBe("recommended");
});

it("serializes date sort and omits the recommended default", () => {
  const base = { window: "all", category: null, keyword: null, venueId: null } as const;
  expect(eventSearchHref({ ...base, sort: "date" })).toBe("/events?sort=date");
  expect(eventSearchHref({ ...base, sort: "recommended" })).toBe("/events");
});
```

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `npx vitest run tests/event-search-params.test.ts tests/event-search-url.test.ts`

Expected: FAIL because `parseEventSort` and `sort` do not exist.

- [ ] **Step 3: Implement the typed parser and serializer**

```ts
// lib/event-search-params.ts
export const EVENT_SORTS = ["recommended", "date"] as const;
export type EventSort = (typeof EVENT_SORTS)[number];

export function parseEventSort(value: PublicValue): EventSort {
  return typeof value === "string" && EVENT_SORTS.includes(value as EventSort)
    ? value as EventSort
    : "recommended";
}
```

```ts
// lib/event-search-url.ts
import type { EventSort } from "./event-search-params";

export type EventSearchState = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort: EventSort;
};

// Add after venue serialization in eventSearchHref:
if (state.sort !== "recommended") params.set("sort", state.sort);
```

In `app/events/page.tsx`, parse `searchParams.sort` with `parseEventSort` and pass it to `EventsPageContent`.

- [ ] **Step 4: Run focused and page-routing tests**

Run: `npx vitest run tests/event-search-params.test.ts tests/event-search-url.test.ts tests/portal-navigation.test.tsx`

Expected: PASS after updating existing `eventSearchHref` fixtures with `sort: "recommended"`.

- [ ] **Step 5: Commit canonical sort state**

```bash
git add app/events/page.tsx lib/event-search-params.ts lib/event-search-url.ts tests/event-search-params.test.ts tests/event-search-url.test.ts tests/portal-navigation.test.tsx
git commit -m "feat: add canonical event result sorting"
```

### Task 3: Build truthful discovery derivation

**Files:**
- Modify: `lib/events.ts`
- Create: `lib/event-discovery.ts`
- Create: `tests/event-discovery.test.ts`

**Interfaces:**
- Consumes: `KiwiCueEvent[]`, an explicit `Date`, and optional normalized metadata.
- Produces: `EventAdmission`, `EventAreaId`, `DiscoveryModel`, `deriveEventArea(event)`, `buildEventDiscovery(events, now)`, `sortDiscoveryEvents(events, sort)`, and `groupEventsByAucklandDate(events)`.

- [ ] **Step 1: Write failing truth and determinism tests**

```ts
import { buildEventDiscovery, deriveEventArea, groupEventsByAucklandDate } from "../lib/event-discovery";

it("selects a deterministic lead without calling it popular", () => {
  const result = buildEventDiscovery([sparse, complete, curated], NOW);
  expect(result.lead.map(({ id }) => id)).toEqual([curated.id, complete.id, sparse.id]);
  expect(JSON.stringify(result)).not.toMatch(/popular|trending/i);
});

it("includes picks and free events only with explicit evidence", () => {
  const result = buildEventDiscovery([
    { ...complete, admission: { kind: "free", currency: "NZD" } },
    { ...sparse, admission: { kind: "unknown" } },
    curated,
  ], NOW);
  expect(result.free.map(({ id }) => id)).toEqual([complete.id]);
  expect(result.picks.map(({ id }) => id)).toEqual([curated.id]);
});

it("groups by Auckland local date instead of the browser timezone", () => {
  expect(groupEventsByAucklandDate([lateUtc]).map(({ date }) => date))
    .toEqual([lateUtc.start.localDate]);
});

it("maps validated Auckland coordinates into transparent discovery areas", () => {
  expect(deriveEventArea(eventAt(-36.8485, 174.7633))).toBe("central");
  expect(deriveEventArea(eventAt(-36.7820, 174.7560))).toBe("north");
  expect(deriveEventArea(eventAt(-36.8890, 174.6200))).toBe("west");
  expect(deriveEventArea(eventAt(-37.0100, 174.7900))).toBe("south");
  expect(deriveEventArea(eventAt(-36.9000, 174.9000))).toBe("east");
  expect(deriveEventArea(eventAt(0, 0))).toBeNull();
});
```

Create fixtures with fixed ids, dates, images, venue completeness, source evidence, coordinates, and admissions so every branch is explicit.

- [ ] **Step 2: Run the new tests and confirm red**

Run: `npx vitest run tests/event-discovery.test.ts`

Expected: FAIL because `lib/event-discovery.ts` and the optional types do not exist.

- [ ] **Step 3: Add optional normalized event fields**

```ts
// lib/events.ts
export type EventAdmission =
  | { kind: "free"; currency: "NZD" }
  | { kind: "range"; currency: "NZD"; min: number; max: number }
  | { kind: "unknown" };

export type EventAreaId = "central" | "north" | "west" | "south" | "east";

// Add to KiwiCueEvent:
admission?: EventAdmission;
areaId?: EventAreaId;
organiserName?: string;
```

- [ ] **Step 4: Implement pure discovery functions**

```ts
// lib/event-discovery.ts
import { Temporal } from "@js-temporal/polyfill";
import type { EventAreaId, KiwiCueEvent } from "./events";
import type { EventSort } from "./event-search-params";
import { resolveEventWindow } from "./event-window";

export type EventDateGroup = { date: string; events: KiwiCueEvent[] };
export type DiscoveryModel = {
  lead: KiwiCueEvent[];
  weekend: KiwiCueEvent[];
  picks: KiwiCueEvent[];
  free: KiwiCueEvent[];
  areas: Array<{ id: EventAreaId; count: number }>;
  dateGroups: EventDateGroup[];
};

function instant(event: KiwiCueEvent): Temporal.Instant | null {
  try {
    if (event.start.dateTime) return Temporal.Instant.from(event.start.dateTime);
    return Temporal.ZonedDateTime.from(
      `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}[Pacific/Auckland]`,
    ).toInstant();
  } catch {
    return null;
  }
}

function score(event: KiwiCueEvent): number {
  return (instant(event) ? 16 : 0)
    + (event.imageUrl || event.editorialPreview?.image ? 8 : 0)
    + (event.venue?.name ? 4 : 0)
    + (event.venue?.city ? 2 : 0)
    + (event.source?.url ? 4 : 0)
    + (event.editorialPreview ? 8 : 0);
}

export function sortDiscoveryEvents(events: KiwiCueEvent[], sort: EventSort): KiwiCueEvent[] {
  return [...new Map(events.map((event) => [event.id, event])).values()].sort((a, b) => {
    const aTime = instant(a)?.epochMilliseconds ?? Number.MAX_SAFE_INTEGER;
    const bTime = instant(b)?.epochMilliseconds ?? Number.MAX_SAFE_INTEGER;
    return (sort === "recommended" ? score(b) - score(a) : 0)
      || aTime - bTime
      || a.id.localeCompare(b.id);
  });
}

export function groupEventsByAucklandDate(events: KiwiCueEvent[]): EventDateGroup[] {
  const groups = new Map<string, KiwiCueEvent[]>();
  for (const event of sortDiscoveryEvents(events, "date")) {
    const list = groups.get(event.start.localDate) ?? [];
    list.push(event);
    groups.set(event.start.localDate, list);
  }
  return [...groups].map(([date, grouped]) => ({ date, events: grouped }));
}

export function deriveEventArea(event: KiwiCueEvent): EventAreaId | null {
  if (event.areaId) return event.areaId;
  const coordinates = event.venue?.coordinates;
  if (!coordinates) return null;
  const { latitude, longitude } = coordinates;
  const withinAuckland = Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -37.3 && latitude <= -36.45
    && longitude >= 174.3 && longitude <= 175.2;
  if (!withinAuckland) return null;
  if (latitude <= -36.95) return "south";
  if (longitude < 174.70) return "west";
  if (longitude > 174.82) return "east";
  if (latitude > -36.80) return "north";
  return "central";
}

export function buildEventDiscovery(events: KiwiCueEvent[], now: Date): DiscoveryModel {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid discovery anchor");
  const blocked = new Set(["cancelled", "postponed", "offsale"]);
  const available = sortDiscoveryEvents(events, "recommended").filter((event) => {
    const start = instant(event)?.epochMilliseconds;
    return start !== undefined && start >= nowMs && !blocked.has(event.status.toLowerCase());
  });
  const weekendWindow = resolveEventWindow("weekend", now);
  const weekendEnd = weekendWindow.end?.getTime() ?? weekendWindow.start.getTime();
  const weekend = available.filter((event) => {
    const start = instant(event)?.epochMilliseconds ?? -1;
    return start >= weekendWindow.start.getTime() && start < weekendEnd;
  });
  const areaCounts = new Map<EventAreaId, number>();
  for (const event of available) {
    const area = deriveEventArea(event);
    if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  }
  return {
    lead: available.slice(0, 3),
    weekend,
    picks: available.filter((event) => Boolean(event.editorialPreview || event.source)),
    free: available.filter((event) => event.admission?.kind === "free"),
    areas: [...areaCounts].map(([id, count]) => ({ id, count })),
    dateGroups: groupEventsByAucklandDate(available),
  };
}
```

- [ ] **Step 5: Run derivation tests**

Run: `npx vitest run tests/event-discovery.test.ts`

Expected: PASS for ordering, weekend bounds, picks, free evidence, areas, invalid dates, de-duplication, and Auckland grouping.

- [ ] **Step 6: Commit discovery domain logic**

```bash
git add lib/events.ts lib/event-discovery.ts tests/event-discovery.test.ts
git commit -m "feat: derive truthful event discovery collections"
```

### Task 4: Normalize optional admission and organiser evidence

**Files:**
- Modify: `lib/ticketmaster.ts`
- Modify: `tests/ticketmaster-client.test.ts`

**Interfaces:**
- Consumes: Ticketmaster `priceRanges` and `promoter.name` values.
- Produces: `KiwiCueEvent.admission` and `KiwiCueEvent.organiserName` only when validated.

- [ ] **Step 1: Write failing normalization tests**

```ts
it("normalizes exact NZD admission and a bounded organiser name", () => {
  const normalized = normalizeTicketmasterEvent(payload({
    priceRanges: [{ currency: "NZD", min: 0, max: 0 }],
    promoter: { name: "Auckland Arts Festival" },
  }));
  expect(normalized).toMatchObject({
    admission: { kind: "free", currency: "NZD" },
    organiserName: "Auckland Arts Festival",
  });
});

it.each([
  [{ currency: "USD", min: 0, max: 0 }],
  [{ currency: "NZD", min: -1, max: 20 }],
  [{ currency: "NZD", min: 30, max: 20 }],
  [{ currency: "NZD", min: Number.NaN, max: 20 }],
])("omits invalid admission evidence", (priceRanges) => {
  expect(normalizeTicketmasterEvent(payload({ priceRanges }))?.admission).toBeUndefined();
});
```

- [ ] **Step 2: Run the client tests and confirm red**

Run: `npx vitest run tests/ticketmaster-client.test.ts`

Expected: FAIL because the payload types and normalized fields are absent.

- [ ] **Step 3: Implement defensive normalization**

```ts
function normalizeAdmission(range: TicketmasterPriceRange | undefined): EventAdmission | undefined {
  if (!range || range.currency !== "NZD") return undefined;
  const { min, max } = range;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return undefined;
  return min === 0 && max === 0
    ? { kind: "free", currency: "NZD" }
    : { kind: "range", currency: "NZD", min, max };
}

function normalizeOrganiser(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const value = name.normalize("NFC").trim().replace(/\s+/gu, " ");
  return value && [...value].length <= 120 ? value : undefined;
}
```

Extend the private Ticketmaster payload type with optional `priceRanges` and `promoter`, then spread only defined normalized values into both list and detail normalization.

- [ ] **Step 4: Run client and route regression tests**

Run: `npx vitest run tests/ticketmaster-client.test.ts tests/events-route.test.ts tests/event-detail-route.test.ts`

Expected: PASS, with unsafe and unsupported provider values omitted.

- [ ] **Step 5: Commit provider evidence**

```bash
git add lib/ticketmaster.ts tests/ticketmaster-client.test.ts
git commit -m "feat: normalize verified event admission metadata"
```

### Task 5: Build the unified filters and mobile dialog

**Files:**
- Create: `components/event-discovery-controls.tsx`
- Create: `components/event-filter-dialog.tsx`
- Modify: `tests/event-search-panel.test.tsx`
- Modify: `tests/portal-navigation.test.tsx`
- Modify: `tests/portal-accessibility-contract.test.tsx`

**Interfaces:**
- Consumes: `EventSearchState`, bilingual language context, existing venue API, `eventSearchHref`.
- Produces: `EventDiscoveryControls({ state })` and `EventFilterDialog({ state, open, onClose })`.

- [ ] **Step 1: Write failing interaction and accessibility tests**

```tsx
it("shows active filters, removes one, and clears all", () => {
  renderControls({ window: "weekend", category: "concerts", keyword: "Jazz", venueId: null, sort: "date" });
  expect(screen.getByRole("link", { name: "Remove Jazz filter" })).toHaveAttribute(
    "href",
    "/events?window=weekend&category=concerts&sort=date",
  );
  expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute("href", "/events");
});

it("traps and restores focus in the mobile filter dialog", async () => {
  renderControls(defaultState);
  const trigger = screen.getByRole("button", { name: "Open filters" });
  fireEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "Filter Auckland events" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(trigger).toHaveFocus();
});
```

- [ ] **Step 2: Run focused tests and confirm red**

Run: `npx vitest run tests/event-search-panel.test.tsx tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx`

Expected: FAIL because the new controls and dialog do not exist.

- [ ] **Step 3: Implement shared filter-state links**

```tsx
export function EventDiscoveryControls({ state }: { state: EventSearchState }) {
  const [open, setOpen] = useState(false);
  const active = buildActiveEventFilters(state);
  return (
    <section className="event-discovery-controls" aria-label="Event discovery controls">
      <EventSearchPanel {...state} />
      <div className="event-active-filters" aria-label="Active event filters">
        {active.map((filter) => (
          <Link key={filter.id} href={eventSearchHref(filter.nextState)} aria-label={filter.removeLabel}>
            {filter.label}<span aria-hidden="true"> ×</span>
          </Link>
        ))}
        {active.length > 0 && <Link href="/events">Clear all filters</Link>}
      </div>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Open filters</button>
      <EventFilterDialog state={state} open={open} onClose={() => setOpen(false)} returnFocusRef={triggerRef} />
    </section>
  );
}
```

Keep bilingual strings in an `en`/`zh` copy object, generate chip removal states immutably, and reuse the existing validated search/venue inputs rather than duplicating parsing.

- [ ] **Step 4: Implement dialog keyboard behaviour**

```tsx
useEffect(() => {
  if (!open) return;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialogRef.current?.focus();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") keepFocusInside(event, dialogRef.current);
  };
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = previousOverflow;
    returnFocusRef.current?.focus();
  };
}, [onClose, open, returnFocusRef]);
```

Render `role="dialog"`, `aria-modal="true"`, `tabIndex={-1}`, a labelled heading, close button, category/window/sort controls, and a submit action. `keepFocusInside` cycles between enabled focusable descendants.

- [ ] **Step 5: Run interaction and accessibility tests**

Run: `npx vitest run tests/event-search-panel.test.tsx tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx`

Expected: PASS in English and Chinese, including Escape, Tab cycling, focus restoration, and canonical hrefs.

- [ ] **Step 6: Commit unified filters**

```bash
git add components/event-discovery-controls.tsx components/event-filter-dialog.tsx components/event-search-panel.tsx tests/event-search-panel.test.tsx tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx
git commit -m "feat: add responsive event discovery filters"
```

### Task 6: Render discovery mode and focused results mode

**Files:**
- Create: `components/event-lead-story.tsx`
- Create: `components/event-discovery-sections.tsx`
- Modify: `components/events-page-content.tsx`
- Modify: `app/events/event-explorer.tsx`
- Modify: `app/events/event-card.tsx`
- Modify: `tests/events-page-content.test.tsx`
- Modify: `tests/event-explorer.test.tsx`
- Modify: `tests/event-card.test.tsx`

**Interfaces:**
- Consumes: `DiscoveryModel`, `EventSearchState`, `KiwiCueEvent[]`, cursor result state.
- Produces: editorial discovery when no explicit filters exist and grouped results when any filter exists.

- [ ] **Step 1: Write failing mode and state tests**

```tsx
it("renders the editorial discovery hierarchy for the default route", async () => {
  renderExplorer(defaultState, richResult);
  expect(await screen.findByRole("heading", { name: "Start here" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "This weekend" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Explore by category" })).toBeVisible();
  expect(screen.queryByText(/popular|trending/i)).not.toBeInTheDocument();
});

it("switches to focused date-grouped results for an explicit filter", async () => {
  renderExplorer({ ...defaultState, keyword: "Jazz" }, richResult);
  expect(await screen.findByRole("heading", { name: "Results for “Jazz”" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Start here" })).not.toBeInTheDocument();
  expect(screen.getByText("SAT")).toBeVisible();
});

it("retains shown events when loading another cursor fails", async () => {
  const request = vi.fn().mockResolvedValueOnce(firstPage).mockRejectedValueOnce(new Error("private"));
  renderExplorer(defaultState, request);
  fireEvent.click(await screen.findByRole("button", { name: "Show more events" }));
  expect(await screen.findByText("Loading more events failed. Your shown events are still here.")).toBeVisible();
  expect(screen.getByRole("heading", { name: firstPage.events[0].name })).toBeVisible();
});
```

- [ ] **Step 2: Run component tests and confirm red**

Run: `npx vitest run tests/events-page-content.test.tsx tests/event-explorer.test.tsx tests/event-card.test.tsx`

Expected: FAIL on the missing editorial sections and result heading.

- [ ] **Step 3: Implement page mode selection**

```ts
export function hasExplicitEventFilters(state: EventSearchState): boolean {
  return Boolean(
    state.keyword
    || state.venueId
    || state.category
    || state.window !== "all"
    || state.sort !== "recommended",
  );
}
```

```tsx
const discovery = buildEventDiscovery(state.events, new Date());
return isFiltered ? (
  <EventResultsView state={searchState} groups={groupEventsByAucklandDate(
    sortDiscoveryEvents(state.events, searchState.sort),
  )} />
) : (
  <EventDiscoveryView model={discovery} searchState={searchState} />
);
```

Use a single `EventExplorer` request lifecycle. Add `AbortController` support to `requestEventsFromApi` and abort stale initial requests in the effect cleanup. Continue using request generation checks for injected test requests.

- [ ] **Step 4: Implement editorial sections and variants**

`EventLeadStory` renders one `EventCard variant="lead"` and up to two `variant="supporting"` cards. `EventDiscoverySections` renders only non-empty collections, category/mood/area links through `eventSearchHref`, and chronological continuation through `EventDateGroup`. `EventCard` accepts:

```ts
type EventCardProps = {
  event: KiwiCueEvent;
  variant?: "lead" | "supporting" | "row" | "standard";
  showAdmission?: boolean;
};
```

Mood shortcuts are explicit aliases for existing filters, not inferred recommendations:

```ts
type LocalizedLabel = { en: string; zh: string };
const DEFAULT_SEARCH: EventSearchState = {
  window: "all",
  category: null,
  keyword: null,
  venueId: null,
  sort: "recommended",
};

const EVENT_MOODS: Array<{ id: string; label: LocalizedLabel; state: EventSearchState }> = [
  { id: "live-music", label: { en: "Live music", zh: "现场音乐" }, state: { ...DEFAULT_SEARCH, category: "concerts", window: "30d" } },
  { id: "stage-night", label: { en: "A stage night", zh: "剧场之夜" }, state: { ...DEFAULT_SEARCH, category: "theatre", window: "30d" } },
  { id: "market-morning", label: { en: "Market morning", zh: "周末市集" }, state: { ...DEFAULT_SEARCH, category: "markets", window: "weekend" } },
  { id: "festival-day", label: { en: "Festival day", zh: "节庆一日" }, state: { ...DEFAULT_SEARCH, category: "festivals", window: "30d" } },
  { id: "match-day", label: { en: "Match day", zh: "比赛日" }, state: { ...DEFAULT_SEARCH, category: "sports", window: "30d" } },
];
```

Admission copy is produced by a locale-aware formatter and is rendered only when `event.admission` is `free` or a verified range. Lead and supporting variants keep the existing `BookmarkButton`, detail route, official-source semantics, and safe image handling.

- [ ] **Step 5: Run component and regression tests**

Run: `npx vitest run tests/events-page-content.test.tsx tests/event-explorer.test.tsx tests/event-card.test.tsx tests/bookmark-button.test.tsx tests/bilingual-pages.test.tsx`

Expected: PASS for discovery, filtered results, pagination, retry, empty, error, save, optional metadata, and both locales.

- [ ] **Step 6: Commit dual-mode composition**

```bash
git add components/event-lead-story.tsx components/event-discovery-sections.tsx components/events-page-content.tsx app/events/event-explorer.tsx app/events/event-card.tsx tests/events-page-content.test.tsx tests/event-explorer.test.tsx tests/event-card.test.tsx
git commit -m "feat: build editorial event discovery experience"
```

### Task 7: Apply the responsive editorial visual system

**Files:**
- Modify: `app/styles/events.css`
- Modify: `app/styles/responsive.css`
- Create: `tests/events-editorial-theme.test.ts`
- Modify: `tests/portal-theme.test.ts`
- Modify: `tests/portal-accessibility-contract.test.tsx`

**Interfaces:**
- Consumes: semantic class names from Tasks 5 and 6.
- Produces: warm neutral, border-light, asymmetric responsive layouts and reduced-motion behaviour.

- [ ] **Step 1: Write failing source-level style invariants**

```ts
it("uses an asymmetric lead grid without a black runway border", () => {
  const css = readEventCss();
  expect(css).toMatch(/\.event-lead-story\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(18rem,\s*1fr\)/s);
  expect(css).not.toMatch(/\.event-(?:feed|grid|lead-story)[^{]*{[^}]*border:\s*1px\s+solid\s+(?:#000|var\(--ink\))/s);
});

it("contains 375px mobile and reduced-motion contracts", () => {
  const css = readAllPortalCss();
  expect(css).toMatch(/@media\s*\(max-width:\s*639px\)/);
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(css).toMatch(/min-height:\s*44px/);
});
```

- [ ] **Step 2: Run theme tests and confirm red**

Run: `npx vitest run tests/events-editorial-theme.test.ts tests/portal-theme.test.ts`

Expected: FAIL until the new grid and responsive contracts exist.

- [ ] **Step 3: Implement the core desktop/tablet styling**

```css
.events-page {
  --events-canvas: #f4f1e9;
  --events-ink: #171916;
  --events-muted: #62675f;
  --events-line: color-mix(in srgb, var(--events-ink) 14%, transparent);
  --events-accent: #116c55;
  background: var(--events-canvas);
  color: var(--events-ink);
}

.event-lead-story {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
  gap: clamp(1rem, 2vw, 2rem);
}

.event-card {
  border: 0;
  border-top: 1px solid var(--events-line);
  background: transparent;
  border-radius: 0;
}

.event-date-group {
  display: grid;
  grid-template-columns: minmax(5rem, 8rem) minmax(0, 1fr);
  gap: clamp(1rem, 3vw, 3rem);
}

.event-filter-dialog button,
.event-discovery-controls button,
.event-active-filters a {
  min-height: 44px;
}
```

Preserve existing design tokens used outside events. Use the green accent only for actions, selected state, and small editorial markers.

- [ ] **Step 4: Implement mobile and motion rules**

```css
@media (max-width: 639px) {
  .event-lead-story,
  .event-date-group {
    grid-template-columns: minmax(0, 1fr);
  }

  .event-filter-dialog {
    position: fixed;
    inset: 0;
    z-index: 100;
    overflow-y: auto;
    background: var(--events-canvas);
  }

  .event-card-row {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .events-page *,
  .events-page *::before,
  .events-page *::after {
    scroll-behavior: auto;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 5: Run theme and accessibility contract tests**

Run: `npx vitest run tests/events-editorial-theme.test.ts tests/portal-theme.test.ts tests/portal-accessibility-contract.test.tsx`

Expected: PASS with no rigid black runway border, mobile overflow contract, or missing focus/reduced-motion rule.

- [ ] **Step 6: Commit the visual system**

```bash
git add app/styles/events.css app/styles/responsive.css tests/events-editorial-theme.test.ts tests/portal-theme.test.ts tests/portal-accessibility-contract.test.tsx
git commit -m "style: apply editorial events discovery system"
```

### Task 8: Verify discovery end to end

**Files:**
- Create: `e2e/events-editorial.spec.ts`
- Modify: event implementation files only for defects demonstrated by verification.

**Interfaces:**
- Consumes: the completed discovery route.
- Produces: repeatable desktop/mobile evidence and a green release gate.

- [ ] **Step 1: Add browser assertions for the critical journeys**

```ts
test("discovery and filtered results remain usable at desktop and mobile", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: "Find something worth doing." })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await page.getByRole("textbox", { name: "Search Auckland events" }).fill("Jazz");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Jazz/);
  await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
});
```

Add a 375×812 project/case that opens and closes the filter dialog with keyboard input, a Chinese-locale case, a no-results case, and screenshot assertions for discovery and results.

- [ ] **Step 2: Run the full automated gate**

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with no warnings from changed files.

Run: `npm run build`

Expected: PASS and `/events` builds successfully.

Run: `npm run test:e2e`

Expected: PASS for desktop and 375 px journeys.

- [ ] **Step 3: Inspect generated screenshots manually**

Verify discovery, filtered results, no-results, loading/error fixture, and Chinese views at 1440×1000, 768×1024, and 375×812. Confirm no black runway border, clipped copy, horizontal overflow, false free/popular claims, or obscured focus.

- [ ] **Step 4: Run the final diff hygiene check**

Run: `git diff --check`

Expected: no output.

Run: `git status --short`

Expected: only intentional Plan A files; `skills-lock.json` is absent from the worktree status.

- [ ] **Step 5: Commit verification coverage**

```bash
git add e2e/events-editorial.spec.ts
git commit -m "test: cover editorial event discovery journeys"
```
