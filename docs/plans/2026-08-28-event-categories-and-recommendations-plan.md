# Event Categories and Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver descriptive event categories and a transparent, privacy-preserving recommendation page that helps users choose an Auckland plan quickly.

**Architecture:** Extend the existing category contract and navigation, then add a pure deterministic recommendation engine consumed by one client page. The page reuses validated event feeds, bookmark context, display helpers, media, and detail routes; saved-event affinity never leaves the browser.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript 5, CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Branch from main; do not stage the unrelated skills-lock.json.
- Keep functions under 40 lines by separating parsing, scoring, diversity selection, copy, and rendering.
- Do not use any, empty catches, production console.log, accounts, analytics, location, scraping, paid services, or new credentials.
- Validate API payloads and expose no upstream bodies or secrets.
- Keep English and Simplified Chinese complete.
- Support loading, ready, partial, empty, and error states.
- Maintain 44×44px targets, visible focus, reduced motion, and no overflow at 375px, 768px, and 1440px.
- Never claim popularity, trends, proximity, or sales without supporting data.

---

### Task 1: Extend and Redesign Event Categories

**Files:**
- Modify: lib/event-categories.ts
- Modify: lib/ticketmaster.ts
- Modify: components/event-category-nav.tsx
- Modify: app/events/event-explorer.tsx
- Modify: app/styles/shell.css
- Modify: app/styles/responsive.css
- Test: tests/ticketmaster-client.test.ts
- Test: tests/portal-navigation.test.tsx
- Test: tests/bilingual-pages.test.tsx
- Test: tests/event-card.test.tsx

**Interfaces:**
- Produces EventCategory values concerts, theatre, markets, festivals, and sports.
- Preserves eventSearchHref(EventSearchState) and every non-category filter.

- [ ] **Step 1: Add failing category tests**

Add assertions:

~~~ts
expect(parseEventCategory("sports")).toBe("sports");
const url = buildAucklandEventsUrl({ apiKey: "secret", category: "sports" });
expect(url.searchParams.get("classificationName")).toBe("Sports");
expect(screen.getByRole("link", { name: /Sports/ })).toHaveAttribute(
  "href",
  "/events?window=weekend&category=sports&q=Taylor&venue=venue-1",
);
expect(screen.getByText("Live sport across Auckland")).toBeVisible();
~~~

Run:

~~~powershell
npx vitest run tests/ticketmaster-client.test.ts tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx
~~~

Expected: FAIL because sports and descriptive category copy do not exist.

- [ ] **Step 2: Extend the model and provider map**

Add sports to EVENT_CATEGORIES and add sports: ["classificationName", "Sports"] to CATEGORY_FILTERS.

- [ ] **Step 3: Replace category pills with cards**

Keep EventCategoryNav props unchanged. Define bilingual code, label, and description values for All, Concerts, Theatre, Markets, Festivals, and Sports. Render each as:

~~~tsx
<Link
  className="event-category-card"
  data-category={value ?? "all"}
  href={eventSearchHref({ window, category: value, keyword, venueId })}
  aria-current={category === value ? "page" : undefined}
>
  <span className="event-category-code" aria-hidden="true">{item.code}</span>
  <strong>{item.label}</strong>
  <small>{item.description}</small>
</Link>
~~~

English descriptions are:
- A broad mix, ordered by date
- Live music and touring artists
- Plays, comedy and live performance
- Food, makers and neighbourhood finds
- Big days and cultural gatherings
- Live sport across Auckland

Provide concise equivalent Chinese descriptions.

- [ ] **Step 4: Add responsive category styles and truthful feed copy**

Use six columns when space permits, three below 1200px, and two at 600px. The All card spans both columns on small screens. Cards have min-height 88px, visible focus, reduced motion, and no horizontal scroll.

Change feed intro to:
- English: Events stay in date order so the next useful option is easy to scan.
- Chinese: 活动继续按时间排列，方便快速找到下一项可选安排。

- [ ] **Step 5: Verify and commit**

~~~powershell
npx vitest run tests/ticketmaster-client.test.ts tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx tests/event-card.test.tsx
git add lib/event-categories.ts lib/ticketmaster.ts components/event-category-nav.tsx app/events/event-explorer.tsx app/styles/shell.css app/styles/responsive.css tests/ticketmaster-client.test.ts tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx tests/event-card.test.tsx
git commit -m "feat(events): make categories easier to browse"
~~~

Expected: focused tests pass and the commit contains only category work.

---

### Task 2: Build the Pure Recommendation Engine

**Files:**
- Create: lib/event-recommendations.ts
- Test: tests/event-recommendations.test.ts

**Interfaces:**

~~~ts
export type RecommendationReason =
  | "saved-affinity"
  | "weekend"
  | "soon"
  | "verified"
  | "well-detailed";

export type EventRecommendation = {
  event: KiwiCueEvent;
  reason: RecommendationReason;
};

export type EventRecommendationSections = {
  startHere: EventRecommendation[];
  weekend: EventRecommendation[];
  somethingDifferent: EventRecommendation[];
};

export function buildEventRecommendations(input: {
  events: KiwiCueEvent[];
  savedEvents: KiwiCueEvent[];
  now: Date;
}): EventRecommendationSections;
~~~

- [ ] **Step 1: Write failing engine tests**

Use now = new Date("2026-08-28T00:00:00Z"). Test exclusion of past, cancelled, postponed, rescheduled, off-sale, invalid-date, and already-saved events. Test saved affinity, truthful reasons, stable ordering, category and venue diversity, and section limits 3, 4, and 4.

~~~ts
const result = buildEventRecommendations({
  events: [musicSoon, theatreSoon, secondMusicSoon, savedMusic],
  savedEvents: [savedMusic],
  now,
});
expect(result.startHere.map(({ event }) => event.id))
  .toEqual(["music-soon", "theatre-soon"]);
expect(result.startHere[0].reason).toBe("saved-affinity");
~~~

Run: npx vitest run tests/event-recommendations.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement pure helpers**

Implement:

~~~ts
function eventInstant(event: KiwiCueEvent): Temporal.Instant | null;
function discoveryCategory(event: KiwiCueEvent): EventCategory | "other";
function eligibility(event: KiwiCueEvent, now: Temporal.Instant): boolean;
function eventScore(event: KiwiCueEvent, context: ScoreContext): number;
function recommendationReason(
  event: KiwiCueEvent,
  context: ScoreContext,
): RecommendationReason;
function selectDiverse(
  candidates: ScoredEvent[],
  limit: number,
): ScoredEvent[];
~~~

Use @js-temporal/polyfill. Map Market→markets, Music→concerts, Sports→sports, Arts & Theatre→theatre, and names containing festival→festivals before raw fallback.

Use score constants savedCategory 30, savedVenue 24, withinSevenDays 20, weekend 16, available 12, verified 6, venue 4, and media 4. Exclude saved IDs. Select diverse first, then fill remaining positions without duplicates. somethingDifferent excludes the dominant saved category when alternatives exist.

- [ ] **Step 3: Verify and commit**

~~~powershell
npx vitest run tests/event-recommendations.test.ts
git add lib/event-recommendations.ts tests/event-recommendations.test.ts
git commit -m "feat(recommendations): add explainable event ranking"
~~~

Expected: all engine tests pass.

---

### Task 3: Build Recommendation Cards and Page States

**Files:**
- Create: app/recommendations/page.tsx
- Create: components/recommendations-page-content.tsx
- Create: components/recommendation-card.tsx
- Create: components/recommendation-skeleton.tsx
- Test: tests/recommendations-page-content.test.tsx

**Interfaces:**
- Consumes buildEventRecommendations, useBookmarks, two event feeds, existing display/media/bookmark utilities.
- Produces /recommendations with loading, ready, partial, empty, and error states.

- [ ] **Step 1: Write failing component-state tests**

Assert loading, personalized ready, non-personalized ready, partial, empty, error, retry, language switch without refetch, and separate bookmark/detail actions.

~~~ts
expect(screen.getByRole("status"))
  .toHaveTextContent("Finding useful Auckland plans");
expect(await screen.findByRole("heading", { name: "Start here" })).toBeVisible();
expect(screen.getByText("Matches events you saved")).toBeVisible();
expect(screen.getByRole("heading", { name: "This weekend" })).toBeVisible();
expect(screen.getByRole("heading", { name: "Try something different" })).toBeVisible();
~~~

Run: npx vitest run tests/recommendations-page-content.test.tsx

Expected: FAIL because the page components do not exist.

- [ ] **Step 2: Implement safe parallel loading**

Define FeedName = "events" | "markets" and requestFeed(name, signal). Request:
- /api/events?window=30d&size=50
- /api/events?window=30d&category=markets&size=50

Accept only objects containing an events array. Use AbortController and a generation key. Merge by event ID. One failure is partial; two failures are error.

- [ ] **Step 3: Implement the page state machine**

Use:

~~~ts
type RecommendationPageState =
  | { status: "loading" }
  | { status: "ready"; events: KiwiCueEvent[]; failed: FeedName[] }
  | { status: "error" };
~~~

Wait for bookmark hydration before rendering personalized results. Render only non-empty sections. Empty ready data shows category shortcuts and All Events. Partial data keeps recommendations and provides Retry. Both failures use role alert plus Events and Saved links.

- [ ] **Step 4: Implement accessible cards and skeletons**

RecommendationCard receives recommendation, index, and language. It uses one internal details link, EventEditorialPreviewMedia, BookmarkButton, and a visible bilingual reason. RecommendationSkeleton renders three inert card shapes under one polite loading status.

- [ ] **Step 5: Add metadata, verify, and commit**

~~~ts
export const metadata: Metadata = {
  title: "Auckland event picks — KiwiCue",
  description: "Explainable Auckland event recommendations for the next 30 days.",
};
~~~

~~~powershell
npx vitest run tests/event-recommendations.test.ts tests/recommendations-page-content.test.tsx
git add app/recommendations/page.tsx components/recommendations-page-content.tsx components/recommendation-card.tsx components/recommendation-skeleton.tsx tests/recommendations-page-content.test.tsx
git commit -m "feat(recommendations): add useful Auckland picks page"
~~~

Expected: engine and page-state tests pass.

---

### Task 4: Integrate Navigation and Responsive Visual Design

**Files:**
- Modify: components/portal-header.tsx
- Create: app/styles/recommendations.css
- Modify: app/globals.css
- Modify: app/styles/responsive.css
- Modify: tests/portal-navigation.test.tsx
- Modify: tests/portal-accessibility-contract.test.tsx
- Create: tests/recommendations-theme.test.ts

**Interfaces:**
- Produces a discoverable Picks destination with current-page and skip-link support.

- [ ] **Step 1: Add failing navigation and CSS tests**

Require navigation order Events, Picks, Movies, Saved; Chinese 推荐; aria-current on recommendations; skip target recommendation-results; 44px controls; three/two/one-column layouts; visible focus; reduced motion; and no overflow-x hidden workaround.

Run: npx vitest run tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx tests/recommendations-theme.test.ts

Expected: FAIL because Picks and its stylesheet do not exist.

- [ ] **Step 2: Extend the header**

Add recommendations to PortalPage, recommendation-results to SkipTarget, bilingual Picks/推荐 and skip labels, and a real /recommendations link between Events and Movies.

- [ ] **Step 3: Add page-specific styling**

Import recommendations.css after events.css. Define an editorial masthead, privacy note, section headers, three-column grid, card hierarchy, reason badge, partial/error/empty panels, skeletons, category shortcuts, focus-visible states, and reduced motion. Reuse existing tokens. Use two columns at 768px and one at 600px. Keep four header destinations usable at 375px.

- [ ] **Step 4: Verify and commit**

~~~powershell
npx vitest run tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx tests/recommendations-theme.test.ts tests/recommendations-page-content.test.tsx
git add components/portal-header.tsx app/styles/recommendations.css app/globals.css app/styles/responsive.css tests/portal-navigation.test.tsx tests/portal-accessibility-contract.test.tsx tests/recommendations-theme.test.ts
git commit -m "style(recommendations): integrate responsive picks experience"
~~~

Expected: focused navigation, accessibility, theme, and page tests pass.

---

### Task 5: Document and Verify the Complete Journey

**Files:**
- Modify: README.md
- Modify: e2e/portal-interactions.spec.ts
- Verify: all files changed by Tasks 1–4.

- [ ] **Step 1: Add end-to-end scenarios**

Mock both feeds, then test Sports and All preserving filters; Picks navigation; bilingual reasons; bookmark count and local-personalization copy; partial-source retry; keyboard traversal; and no horizontal overflow at 375px, 768px, and 1440px.

Run: npx playwright test e2e/portal-interactions.spec.ts

Expected after fixes: all scenarios pass.

- [ ] **Step 2: Update README**

Document descriptive categories, explainable browser-local recommendations, and /recommendations. State that recommendations use upcoming event facts and optional local saves, not popularity tracking.

- [ ] **Step 3: Run complete automated verification**

~~~powershell
npm test
npm run lint
npm run build
npm run test:e2e
~~~

Expected: zero failures, zero lint errors, successful build, and passing Playwright.

- [ ] **Step 4: Inspect Events and Picks visually**

Run against safe local or mocked data and capture both pages at 375px, 768px, and 1440px. Verify hierarchy, wrapping, state panels, focus visibility, alignment, and overflow. Fix defects and repeat affected checks.

- [ ] **Step 5: Commit final integration**

~~~powershell
git add README.md e2e/portal-interactions.spec.ts
git diff --cached --check
git commit -m "test(recommendations): verify discovery journeys"
git status --short
~~~

Expected: clean feature branch with no skills-lock.json, secrets, credential screenshots, or unrelated files.

- [ ] **Step 6: Update memory, create PR, monitor, and merge**

Update only durable facts in the existing Obsidian notes. Push the feature branch, create a PR titled feat: improve event discovery and recommendations, monitor required checks, and squash-merge after success. Do not force push. Clean the owned worktree only after merge verification.
