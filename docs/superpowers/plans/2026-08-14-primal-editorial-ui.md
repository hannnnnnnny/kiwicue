# KiwiCue Primal-inspired Editorial UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn KiwiCue into a warm, image-led Auckland editorial culture guide without changing its event, movie, map, bookmark, search, or bilingual business behavior.

**Architecture:** Keep the existing Next.js/React/TypeScript/CSS architecture. Rework the shared CSS tokens and bounded style files, add only small semantic variants to existing components, and introduce one focused homepage event-preview component that consumes the existing `/api/events` response. URL parameters and existing providers remain the state owners.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript 5.9, vanilla CSS, Vitest/Testing Library, Playwright.

## Global Constraints

- Branch name remains `feat/primal-editorial-ui`; never use a `codex/` prefix.
- Preserve API behavior, routes, environment variables, Ticketmaster, curated markets, TMDB, maps, distance, bookmarks, and bilingual switching.
- Do not add a UI or animation dependency.
- Do not copy reference-site assets, branding, product content, or ecommerce behavior.
- Use Manrope for UI/body/CJK text and a dependency-free editorial serif stack for selected English display headings.
- Use only centralized color tokens, 8px control radius, 12px panel radius, and 999px semantic pills.
- Maintain 44×44px minimum primary touch targets, WCAG 2.2 AA contrast, visible focus, reduced motion, and no horizontal overflow at 375px.
- Keep `skills-lock.json` unmodified and unstaged.
- Each task ends in a separate commit and must keep its focused tests passing.

## File map

- `app/styles/tokens.css`: authoritative palette, type, spacing, radius, shadow, motion, and layout tokens.
- `app/styles/base.css`: global type primitives, image defaults, focus, reduced motion, and shared editorial labels.
- `app/styles/shell.css`: header, homepage, command/search, filters, status strip, about section, and footer.
- `app/styles/events.css`: asymmetric result grid, featured event, standard event cards, states, and skeletons.
- `app/styles/detail-saved.css`: event detail composition, venue/map panel, market highlights, and saved feed.
- `app/styles/movies.css`: movie search, featured poster layout, movie cards, screening feed, directory, and detail.
- `app/styles/responsive.css`: explicit desktop/tablet/mobile transformations.
- `components/home-content.tsx`: homepage editorial structure and bilingual copy.
- `components/home-event-preview.tsx`: fetch and render one current event from the existing API with loading/error/image-failure states.
- `app/page.tsx`: serve the editorial homepage instead of redirecting the root route.
- `components/portal-header.tsx`: simplified navigation and active-page behavior.
- `components/events-page-content.tsx`: event-page editorial heading and stable result sequence.
- `app/events/event-card.tsx`: semantic featured/standard variant derived from result index.
- `components/event-grid-skeleton.tsx`: skeleton shapes matching featured and standard cards.
- `components/event-detail-content.tsx`: semantic wrappers for the editorial hero and venue facts.
- `components/movie-preview-grid.tsx`: featured first movie and standard poster-card variants.
- `components/movies-page-content.tsx`: editorial movie page structure.
- `components/saved-page-content.tsx`: saved-page masthead and empty-state structure.
- `tests/editorial-design-system.test.ts`: exact token and design-contract coverage.
- `tests/portal-navigation.test.tsx`: navigation and homepage behavior.
- `tests/event-card.test.tsx`: featured/standard event card semantics.
- `tests/event-detail-content.test.tsx`: detail hierarchy and unchanged actions.
- `tests/movie-preview-grid.test.tsx`: featured movie behavior and state completeness.
- `tests/saved-page-content.test.tsx`: saved empty/populated behavior.
- `tests/portal-accessibility-contract.test.tsx`: order, focus, touch, overflow, and motion contracts.
- `e2e/portal-interactions.spec.ts`: cross-width, bilingual, interaction, state, and screenshot coverage.

---

### Task 1: Establish the Primal-inspired design tokens and typography

**Files:**
- Modify: `tests/editorial-design-system.test.ts`
- Modify: `app/styles/tokens.css`
- Modify: `app/styles/base.css`

**Interfaces:**
- Consumes: existing `--portal-*`, radius, spacing, and motion custom properties.
- Produces: `--portal-bg`, `--portal-surface`, `--portal-raised`, `--portal-ink`, `--portal-muted`, `--portal-line`, `--portal-brand`, `--portal-brand-hover`, `--portal-brand-soft`, `--portal-accent`, `--portal-display-font`, `--portal-ui-font`, `--shadow-raised`, and `--motion-fast` for all later tasks.

- [ ] **Step 1: Update the token contract test so the new palette and type stacks are mandatory**

```ts
it("defines the Primal-inspired editorial palette and type system", () => {
  const css = applicationCss().toLowerCase();
  for (const token of [
    "--portal-bg: #f2ede3",
    "--portal-surface: #fbf8f1",
    "--portal-raised: #fffdf8",
    "--portal-ink: #24231f",
    "--portal-muted: #686d64",
    "--portal-line: #d5d0c5",
    "--portal-brand: #344b3b",
    "--portal-accent: #a64f3d",
    "--portal-display-font:",
    "--portal-ui-font:",
    "--radius-control: 8px",
    "--radius-panel: 12px",
    "--radius-pill: 999px",
  ]) expect(css).toContain(token);
});
```

- [ ] **Step 2: Run the design-system test and verify it fails on the old palette**

Run: `npx vitest run tests/editorial-design-system.test.ts --maxWorkers=1`

Expected: FAIL because `#f2ede3`, `--portal-accent`, and the font tokens are absent.

- [ ] **Step 3: Replace the token values and route global typography through the new font properties**

```css
:root {
  color-scheme: light;
  --portal-bg: #f2ede3;
  --portal-surface: #fbf8f1;
  --portal-raised: #fffdf8;
  --portal-ink: #24231f;
  --portal-muted: #686d64;
  --portal-line: #d5d0c5;
  --portal-brand: #344b3b;
  --portal-brand-hover: #24342a;
  --portal-brand-soft: #e7ece5;
  --portal-accent: #a64f3d;
  --portal-focus: #086c78;
  --portal-danger: #963c32;
  --portal-danger-soft: #f5e7e2;
  --portal-white: #fffdf8;
  --portal-shadow-color: rgb(52 43 32 / 10%);
  --portal-display-font: "Iowan Old Style", "Baskerville", "Times New Roman", serif;
  --portal-ui-font: "Manrope Variable", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
  --radius-control: 8px;
  --radius-panel: 12px;
  --radius-pill: 999px;
  --container: 1320px;
  --motion-fast: 200ms ease;
}

body { font-family: var(--portal-ui-font); }

.editorial-display {
  font-family: var(--portal-display-font);
  font-weight: 400;
  letter-spacing: -.045em;
  line-height: .98;
}

:lang(zh) .editorial-display { font-family: var(--portal-ui-font); font-weight: 700; }
```

- [ ] **Step 4: Run the focused test and CSS diff validation**

Run: `npx vitest run tests/editorial-design-system.test.ts tests/portal-theme.test.ts --maxWorkers=1 && git diff --check`

Expected: PASS and no whitespace errors.

- [ ] **Step 5: Commit the design foundation**

```powershell
git add app/styles/tokens.css app/styles/base.css tests/editorial-design-system.test.ts tests/portal-theme.test.ts
git commit -m "style: establish editorial design foundation"
```

### Task 2: Redesign global navigation and homepage discovery

**Files:**
- Create: `components/home-event-preview.tsx`
- Modify: `components/home-content.tsx`
- Modify: `app/page.tsx`
- Modify: `components/portal-header.tsx`
- Modify: `app/styles/shell.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/portal-navigation.test.tsx`
- Modify: `tests/bilingual-pages.test.tsx`
- Modify: `tests/app-shell.test.ts`

**Interfaces:**
- Consumes: `AucklandEventsResult`, `EventImage`, `eventDisplayName`, existing language and bookmark providers, `/api/events?window=30d&size=1`.
- Produces: `HomeEventPreview({ language }: { language: Language })` with `loading | ready | empty | error` rendering and `.home-feature` semantic structure.

- [ ] **Step 1: Add failing tests for the slim navigation, homepage search route, bilingual heading, and event-preview states**

```tsx
it("puts event discovery and one live event in the first homepage region", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(eventResult))));
  render(<LanguageProvider><BookmarkProvider><HomeContent /></BookmarkProvider></LanguageProvider>);
  expect(screen.getByRole("link", { name: "Browse Auckland events" })).toHaveAttribute("href", "/events");
  expect(await screen.findByRole("heading", { name: "Harbour Lights" })).toBeVisible();
  expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused component tests and verify the preview expectation fails**

Run: `npx vitest run tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx --maxWorkers=1`

Expected: FAIL because the homepage does not request or render an event preview.

- [ ] **Step 3: Implement `HomeEventPreview` with strict response parsing and complete states**

```tsx
export function HomeEventPreview({ language }: { language: Language }) {
  const [state, setState] = useState<HomePreviewState>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/events?window=30d&size=1", { signal: controller.signal, headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("HOME_EVENT_UNAVAILABLE");
        const result = await response.json() as AucklandEventsResult;
        setState(result.events[0] ? { status: "ready", event: result.events[0] } : { status: "empty" });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setState({ status: "error" });
      });
    return () => controller.abort();
  }, []);
  return <HomePreviewStateView state={state} language={language} />;
}
```

The state view must use a matching image skeleton while loading, show the event name/date/venue and existing `EventImage` when ready, provide a `/events` link when empty, and show a bilingual retry-safe explanation when unavailable.

- [ ] **Step 4: Recompose `HomeContent` and `PortalHeader` without changing navigation destinations**

Use `<PortalHeader currentPage="events" />` on the homepage, apply `.editorial-display` to the main heading, render `<HomeEventPreview language={language} />`, retain the four category links, and keep all copy bilingual. The homepage primary route remains `/events`; category routes remain `/events?category=...`.

- [ ] **Step 5: Add shell styles for the image-led split hero, editorial index, slim active navigation, and 375px stack**

Required selectors: `.home-hero`, `.home-hero-copy`, `.home-feature`, `.home-feature-media`, `.home-index`, `.home-index-row`, `.portal-header-link[aria-current="page"]`. The feature visual uses a single intentional curved edge; all controls keep tokenized radii.

- [ ] **Step 6: Run homepage/navigation tests and verify they pass**

Run: `npx vitest run tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx tests/app-shell.test.ts --maxWorkers=1`

Expected: PASS.

- [ ] **Step 7: Commit the homepage and navigation**

```powershell
git add components/home-event-preview.tsx components/home-content.tsx components/portal-header.tsx app/styles/shell.css app/styles/responsive.css tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx
git commit -m "feat: create image-led Auckland homepage"
```

### Task 3: Build the editorial event discovery layout

**Files:**
- Modify: `app/events/event-card.tsx`
- Modify: `components/event-grid-skeleton.tsx`
- Modify: `components/events-page-content.tsx`
- Modify: `app/styles/events.css`
- Modify: `app/styles/shell.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/event-card.test.tsx`
- Modify: `tests/event-explorer.test.tsx`
- Modify: `tests/portal-accessibility-contract.test.tsx`

**Interfaces:**
- Consumes: unchanged `EventCard({ event, index, language })` props and chronological result index.
- Produces: deterministic `data-layout="feature" | "standard"` and matching skeleton structure; the first result in every loaded feed is featured without changing result order.

- [ ] **Step 1: Add a failing test for deterministic card variants and accessible information order**

```tsx
it("marks only the first chronological event as the featured editorial story", () => {
  const first = render(<EventCard event={event} index={0} language="en" />);
  expect(first.container.querySelector("article")).toHaveAttribute("data-layout", "feature");
  first.unmount();
  const second = render(<EventCard event={event} index={1} language="en" />);
  expect(second.container.querySelector("article")).toHaveAttribute("data-layout", "standard");
});
```

- [ ] **Step 2: Run the event-card and explorer tests and verify the new contract fails**

Run: `npx vitest run tests/event-card.test.tsx tests/event-explorer.test.tsx --maxWorkers=1`

Expected: FAIL because `data-layout` is absent.

- [ ] **Step 3: Add the stable layout variant without changing event content or links**

```tsx
const layout = index === 0 ? "feature" : "standard";
return (
  <article className="portal-event-card" data-layout={layout} aria-labelledby={titleId}>
    <Link className="portal-event-link" href={`/events/${encodeURIComponent(event.id)}`} aria-label={content.open(displayName)}>
      <div className="portal-event-body">
        <span className="portal-event-rank" aria-label={content.position(index + 1)}>{String(index + 1).padStart(2, "0")}</span>
        <h2 id={titleId}>{displayName}</h2>
        <p className="portal-event-date"><time dateTime={event.start.dateTime ?? event.start.localDate}>{dateTime}</time></p>
        <p className="portal-event-venue">{venue}</p>
        <div className="portal-event-meta">
          <span>{formatEventCategory(event.category, language)}</span>
          <span>{formatEventStatus(event.status, language)}</span>
        </div>
      </div>
      <EventEditorialPreviewMedia event={event} language={language} placement="card" />
      <span className="portal-event-cta">{content.details}<span aria-hidden="true">↗</span></span>
    </Link>
    <BookmarkButton event={event} language={language} />
  </article>
);
```

Move the visual before secondary category/status tags in presentation while keeping title, date, and venue first in document order.

- [ ] **Step 4: Implement the editorial grid and matching skeletons**

```css
.event-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.event-grid > li:first-child { grid-column: span 2; }
.portal-event-card[data-layout="feature"] { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); }
.portal-event-card[data-layout="feature"] .portal-event-media { min-height: 100%; aspect-ratio: auto; }
.portal-event-card[data-layout="standard"] { display: flex; flex-direction: column; }
```

At 768px the grid becomes two columns with the feature spanning both; at 600px and below every card becomes a single column. Skeleton one mirrors the featured card and the remainder mirror standard cards.

- [ ] **Step 5: Restyle search, filters, status, and result summary as one discovery sequence**

Keep the existing form fields, suggestion list, selected states, and URL behavior. Remove the heavy raised-panel look, use a surface band and dividers, prevent desktop action overflow, and keep the mobile field/action order unchanged.

- [ ] **Step 6: Run event and accessibility tests**

Run: `npx vitest run tests/event-card.test.tsx tests/event-explorer.test.tsx tests/event-search-panel.test.tsx tests/portal-accessibility-contract.test.tsx --maxWorkers=1`

Expected: PASS.

- [ ] **Step 7: Commit event discovery**

```powershell
git add app/events/event-card.tsx components/event-grid-skeleton.tsx components/events-page-content.tsx app/styles/events.css app/styles/shell.css app/styles/responsive.css tests/event-card.test.tsx tests/event-explorer.test.tsx tests/portal-accessibility-contract.test.tsx
git commit -m "feat: introduce editorial event discovery"
```

### Task 4: Recompose event details and saved events

**Files:**
- Modify: `components/event-detail-content.tsx`
- Modify: `components/saved-page-content.tsx`
- Modify: `app/styles/detail-saved.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/event-detail-content.test.tsx`
- Modify: `tests/saved-page-content.test.tsx`

**Interfaces:**
- Consumes: unchanged event detail request, `EventEditorialPreviewMedia`, `EventMap`, `DistancePanel`, `MarketPastHighlights`, `BookmarkButton`, and local bookmark provider.
- Produces: `.event-detail-hero`, `.event-detail-facts`, and `.saved-editorial-empty` semantic layout hooks; no public TypeScript API changes.

- [ ] **Step 1: Add failing tests for first-screen fact/action order and saved-empty guidance**

```tsx
expect(isBefore(screen.getByRole("heading", { name: event.name }), screen.getByRole("link", { name: /official/i }))).toBe(true);
expect(screen.getByRole("link", { name: "Browse Auckland events" })).toHaveAttribute("href", "/events");
```

- [ ] **Step 2: Run detail and saved tests and confirm only the new structure assertions fail**

Run: `npx vitest run tests/event-detail-content.test.tsx tests/saved-page-content.test.tsx --maxWorkers=1`

Expected: FAIL on the new class/hierarchy assertions while existing behavior tests remain green.

- [ ] **Step 3: Introduce semantic wrappers and editorial classes**

Wrap the detail heading and preview in `.event-detail-hero`; group date, venue, and status in `.event-detail-facts`; retain both official action links, bookmark, booking instructions, market highlights, description, map, distance, source verification, and retry states. Add `.saved-editorial-empty` only to the existing empty-state branch.

- [ ] **Step 4: Replace nested-card styling with whitespace, rules, and a restrained sticky venue rail**

Desktop uses a wide primary column and 320–360px venue rail. Mobile uses one column; the venue rail loses sticky positioning and left border. Map, distance, verification, and official action remain visually grouped without separate elevated cards.

- [ ] **Step 5: Run focused behavior tests**

Run: `npx vitest run tests/event-detail-content.test.tsx tests/event-map.test.tsx tests/distance-panel.test.tsx tests/saved-page-content.test.tsx tests/bookmark-button.test.tsx --maxWorkers=1`

Expected: PASS.

- [ ] **Step 6: Commit details and saved views**

```powershell
git add components/event-detail-content.tsx components/saved-page-content.tsx app/styles/detail-saved.css app/styles/responsive.css tests/event-detail-content.test.tsx tests/saved-page-content.test.tsx
git commit -m "feat: refine event details and saved journeys"
```

### Task 5: Create the cinema-program movie layout

**Files:**
- Modify: `components/movie-preview-grid.tsx`
- Modify: `components/movies-page-content.tsx`
- Modify: `components/movie-detail-content.tsx`
- Modify: `app/styles/movies.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/movie-preview-grid.test.tsx`
- Modify: `tests/movies-page-content.test.tsx`
- Modify: `tests/movie-detail-content.test.tsx`

**Interfaces:**
- Consumes: existing `MoviePreviewGrid` props, TMDB data, screening feed, cinema directory, and movie-detail request.
- Produces: `data-layout="feature" | "standard"` on movie preview cards, derived only from array index.

- [ ] **Step 1: Add failing tests for the featured first movie and bilingual title stability**

```tsx
expect(container.querySelectorAll('.movie-preview-card[data-layout="feature"]')).toHaveLength(1);
expect(container.querySelectorAll('.movie-preview-card[data-layout="standard"]')).toHaveLength(movies.length - 1);
```

- [ ] **Step 2: Run movie component tests and verify the layout contract fails**

Run: `npx vitest run tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx tests/movie-detail-content.test.tsx --maxWorkers=1`

Expected: FAIL because movie cards have no layout data attribute.

- [ ] **Step 3: Add deterministic movie variants and preserve all content states**

```tsx
{movies.map((movie, index) => (
  <MoviePreviewCard key={movie.id} movie={movie} language={language} layout={index === 0 ? "feature" : "standard"} />
))}
```

Keep poster failure, synopsis fallback, rating/date, retry, empty, attribution, trailer, session, and official cinema links unchanged.

- [ ] **Step 4: Implement the cinema-program layout and responsive rules**

Desktop: the feature spans two columns and uses a landscape text/poster composition; standard previews use poster-led cards. Tablet: feature spans the full row and standards use two columns. Mobile: feature is one column; standard posters may use two columns only at widths where titles and 44px actions fit without overflow, otherwise use one column.

- [ ] **Step 5: Run all movie tests**

Run: `npx vitest run tests/movie-*.test.ts tests/movie-*.test.tsx tests/movies-route.test.ts tests/tmdb.test.ts --maxWorkers=1`

Expected: PASS.

- [ ] **Step 6: Commit movie redesign**

```powershell
git add components/movie-preview-grid.tsx components/movies-page-content.tsx components/movie-detail-content.tsx app/styles/movies.css app/styles/responsive.css tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx tests/movie-detail-content.test.tsx
git commit -m "feat: style movies as an editorial program"
```

### Task 6: Complete cross-width accessibility, states, and browser journeys

**Files:**
- Modify: `tests/editorial-design-system.test.ts`
- Modify: `tests/portal-accessibility-contract.test.tsx`
- Modify: `e2e/portal-interactions.spec.ts`
- Modify: `app/styles/responsive.css`
- Modify: relevant bounded CSS file only when a state fails the audit.

**Interfaces:**
- Consumes: the completed shared/page style contracts and existing E2E mock routes.
- Produces: screenshots under `test-results/editorial-screenshots/` during E2E execution and assertions for widths 375, 768, and 1440.

- [ ] **Step 1: Add failing E2E assertions for overflow, touch targets, bilingual headings, and screenshots**

```ts
async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

await page.screenshot({ path: testInfo.outputPath("events-editorial.png"), fullPage: true });
```

Cover `/`, `/events`, one event detail, `/movies`, one movie detail, and `/saved`; switch to Chinese on event and movie pages; mock loading/empty/error/image-failure branches with the current route fixtures.

- [ ] **Step 2: Run Chromium E2E for mobile first and record real failures**

Run: `npm run test:e2e -- --project=mobile-375`

Expected: new assertions initially expose any overflow, clipped action, or mismatched screenshot state.

- [ ] **Step 3: Fix only observed responsive/accessibility defects**

Use grid collapse, `min-width: 0`, `overflow-wrap: anywhere`, and 44px targets. Do not hide essential text, disable zoom, add horizontal page clipping, or introduce JavaScript layout measurements.

- [ ] **Step 4: Run all three Playwright projects**

Run: `npm run test:e2e`

Expected: all desktop, tablet-768, and mobile-375 tests pass; screenshots exist in the Playwright output directories.

- [ ] **Step 5: Commit responsive and E2E completion**

```powershell
git add app/styles tests/editorial-design-system.test.ts tests/portal-accessibility-contract.test.tsx e2e/portal-interactions.spec.ts
git commit -m "test: verify editorial ui across target widths"
```

### Task 7: Final regression audit and delivery evidence

**Files:**
- Modify: only files implicated by failures.
- Do not modify: `skills-lock.json`.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: a clean feature branch with passing test, lint, type-check, build, and E2E evidence.

- [ ] **Step 1: Run the complete unit and source-contract suite**

Run: `npm test`

Expected: all Vitest and Node site tests pass.

- [ ] **Step 2: Run lint and strict TypeScript checks**

Run: `npm run lint && npx tsc --noEmit`

Expected: both exit 0 with no warnings introduced by the redesign.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build exits 0 and all existing routes compile.

- [ ] **Step 4: Run the complete browser suite once more from a clean build**

Run: `npm run test:e2e`

Expected: all 375px, 768px, and 1440px journeys pass.

- [ ] **Step 5: Review the diff and repository status**

Run: `git diff origin/main...HEAD --check; git diff origin/main...HEAD --stat; git status --short --branch`

Expected: no whitespace errors, only scoped design/test/spec/plan changes, and only the pre-existing untracked `skills-lock.json` outside the branch changes.

- [ ] **Step 6: Commit any final verified correction separately**

```powershell
git add app/styles/tokens.css app/styles/base.css app/styles/shell.css app/styles/events.css app/styles/detail-saved.css app/styles/movies.css app/styles/responsive.css components/home-event-preview.tsx components/home-content.tsx components/portal-header.tsx components/events-page-content.tsx components/event-grid-skeleton.tsx components/event-detail-content.tsx components/saved-page-content.tsx components/movie-preview-grid.tsx components/movies-page-content.tsx components/movie-detail-content.tsx app/events/event-card.tsx tests/editorial-design-system.test.ts tests/portal-theme.test.ts tests/portal-navigation.test.tsx tests/bilingual-pages.test.tsx tests/event-card.test.tsx tests/event-explorer.test.tsx tests/portal-accessibility-contract.test.tsx tests/event-detail-content.test.tsx tests/saved-page-content.test.tsx tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx tests/movie-detail-content.test.tsx e2e/portal-interactions.spec.ts
git commit -m "fix: resolve editorial ui audit findings"
```

Skip this commit when no corrective diff exists.

- [ ] **Step 7: Push, open the issue-linked PR, review checks, merge, and confirm Vercel production only after all local verification passes**

Use `Closes #55` in the PR body. Do not expose environment variables or include `skills-lock.json`.
