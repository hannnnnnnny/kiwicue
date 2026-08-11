# TMDB Movie Previews and Price Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free non-commercial TMDB-powered New Zealand movie previews with shareable in-site detail pages, while removing every event-price field and presentation from KiwiCue.

**Architecture:** A server-only `lib/tmdb.ts` adapter validates and normalizes all TMDB responses into KiwiCue-owned types. Separate `/api/movie-previews` routes keep the existing screening API stable, while client components use those routes for localized discovery and detail states. Event prices are removed at the domain boundary so cards, details, bookmarks, and API responses cannot accidentally reintroduce them.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS, Vitest, Testing Library, Playwright, TMDB API v3.

## Global Constraints

- KiwiCue remains non-commercial while using TMDB's free API.
- Use only `TMDB_READ_ACCESS_TOKEN`; never expose it through a `NEXT_PUBLIC_` variable, page props, logs, or responses.
- Keep `GET /api/movies` unchanged; TMDB uses `/api/movie-previews` and `/api/movie-previews/[movieId]`.
- TMDB supplies metadata, not verified live Auckland session claims.
- Use `region=NZ`; use `en-NZ` for English and `zh-CN` for Chinese metadata.
- Do not add a paid service, scraping, autoplay, user-generated content, or a new runtime dependency.
- All external image and trailer values are normalized; YouTube keys must match `^[A-Za-z0-9_-]{6,32}$`.
- All user query values are NFC-normalized, whitespace-collapsed, and bounded to 100 characters.
- Every main state has loading, empty, error, and unavailable behavior.
- All primary targets are at least 44×44px; no horizontal overflow at 375px, 768px, or 1440px.
- Remove prices from types, Ticketmaster normalization, bookmarks, cards, details, styles, fixtures, and tests.
- Preserve old bookmarks by ignoring their legacy `priceRange` property.
- Do not stage `skills-lock.json`, `.env*` secrets, or screenshots containing credentials.

---

## File structure

### Create

- `lib/movie-previews.ts` — stable KiwiCue movie types and public input parsers.
- `lib/tmdb.ts` — server-only TMDB request, validation, normalization, caching boundary, and error mapping.
- `app/api/movie-previews/route.ts` — validated list/search API.
- `app/api/movie-previews/[movieId]/route.ts` — validated detail API.
- `app/movies/[movieId]/page.tsx` — shareable movie detail route shell.
- `components/movie-preview-grid.tsx` — list states and poster cards.
- `components/movie-poster.tsx` — safe poster fallback behavior.
- `components/movie-detail-content.tsx` — localized detail fetch, trailer, attribution, directory, and errors.
- `components/tmdb-attribution.tsx` — reusable required attribution block.
- `tests/movie-previews.test.ts` — public parsers and types.
- `tests/tmdb.test.ts` — adapter URL, normalization, validation, error, and trailer tests.
- `tests/movie-previews-route.test.ts` — list route contract.
- `tests/movie-preview-detail-route.test.ts` — detail route contract.
- `tests/movie-preview-grid.test.tsx` — list UI states and navigation.
- `tests/movie-detail-content.test.tsx` — detail UI, trailer safety, and fallbacks.

### Modify

- `.env.example` — document empty `TMDB_READ_ACCESS_TOKEN`.
- `app/movies/page.tsx` — keep route metadata and feed initial parameters.
- `components/movies-page-content.tsx` — fetch and render movie previews before sessions and directory.
- `app/styles/movies.css` — movie grid, poster, detail, trailer, attribution, and skeleton styles.
- `app/styles/responsive.css` — 375px/768px/1440px grid and detail layout.
- `lib/events.ts` — remove price types and property.
- `lib/ticketmaster.ts` — ignore upstream `priceRanges`.
- `lib/bookmarks.ts` — ignore legacy price input and serialize price-free events.
- `app/events/event-card.tsx` — remove price import and markup.
- `components/event-detail-content.tsx` — remove price import and markup.
- `app/styles/events.css` and `app/styles/detail-saved.css` — remove price-only rules.
- Existing event, bookmark, Ticketmaster, movie, and E2E tests — remove price fixtures and add the new journeys.

### Delete

- `lib/event-price.ts`
- `tests/event-price.test.ts`

---

### Task 1: Remove prices from the domain and UI

**Files:**
- Delete: `lib/event-price.ts`
- Delete: `tests/event-price.test.ts`
- Modify: `lib/events.ts`
- Modify: `lib/ticketmaster.ts`
- Modify: `lib/bookmarks.ts`
- Modify: `app/events/event-card.tsx`
- Modify: `components/event-detail-content.tsx`
- Modify: `app/styles/events.css`
- Modify: `app/styles/detail-saved.css`
- Modify: all fixtures returned by `rg -l "priceRange|Price on official site|价格以官网为准" tests e2e`
- Test: `tests/bookmarks.test.ts`
- Test: `tests/event-card.test.tsx`
- Test: `tests/event-detail-content.test.tsx`
- Test: `tests/ticketmaster-client.test.ts`

**Interfaces:**
- Consumes: existing `KiwiCueEvent`, Ticketmaster payloads, and bookmark v1 JSON.
- Produces: `KiwiCueEvent` without `priceRange`; bookmark parsing that accepts but discards unknown legacy keys.

- [ ] **Step 1: Change tests to require price-free output**

Remove `priceRange` from valid fixtures. Add this compatibility assertion to `tests/bookmarks.test.ts`:

```ts
it("loads a legacy bookmark while dropping its price range", () => {
  const legacy = { ...validEvent, priceRange: { currency: "NZD", minimum: 20, maximum: 40 } };
  const result = parseBookmarks(JSON.stringify({
    version: 1,
    items: [{ event: legacy, savedAt: "2026-08-12T00:00:00.000Z" }],
  }));
  expect(result).toHaveLength(1);
  expect(result[0]?.event).not.toHaveProperty("priceRange");
});
```

Update card and detail tests to assert:

```ts
expect(screen.queryByText(/price|价格/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and confirm they fail**

Run: `npx vitest run tests/bookmarks.test.ts tests/event-card.test.tsx tests/event-detail-content.test.tsx tests/ticketmaster-client.test.ts`

Expected: FAIL because production models and renderers still require or display `priceRange`.

- [ ] **Step 3: Remove the price pipeline**

Delete `KiwiCuePriceRange`, the `priceRange` property, `parsePriceRange`, `normalizePriceRanges`, price imports, price markup, and price-only CSS. In `parseEvent`, return only validated non-price fields; unknown JSON keys are naturally ignored. Remove `priceRanges` from `TicketmasterEventPayload` because the adapter no longer reads it.

- [ ] **Step 4: Prove no price presentation remains**

Run:

```powershell
rg -n "priceRange|formatEventPrice|normalizePriceRanges|Price on official site|价格以官网为准|portal-event-price|event-detail-price" app components lib tests e2e
```

Expected: no matches.

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run tests/bookmarks.test.ts tests/event-card.test.tsx tests/event-detail-content.test.tsx tests/ticketmaster-client.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app components lib tests e2e
git commit -m "refactor: remove event pricing"
```

---

### Task 2: Build validated TMDB models and adapter

**Files:**
- Create: `lib/movie-previews.ts`
- Create: `lib/tmdb.ts`
- Create: `tests/movie-previews.test.ts`
- Create: `tests/tmdb.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `MoviePreview`, `MoviePreviewDetail`, `MoviePreviewPage`, `MoviePreviewLanguage`, `parseMoviePreviewQuery`, `parseMoviePreviewPage`, `parseMovieId`, `fetchTmdbMoviePreviews`, and `fetchTmdbMovieDetail`.
- Consumers: Tasks 3–5.

- [ ] **Step 1: Write parser and adapter contract tests**

Define tests for these signatures:

```ts
export type MoviePreviewLanguage = "en" | "zh";
export function parseMoviePreviewQuery(value: unknown): string | null;
export function parseMoviePreviewPage(value: unknown): number;
export function parseMovieId(value: unknown): number | null;
export function buildTmdbMovieListUrl(input: {
  language: MoviePreviewLanguage;
  query: string | null;
  page: number;
}): URL;
export function normalizeTmdbMovie(value: unknown): MoviePreview | null;
export function normalizeTmdbMovieDetail(value: unknown): MoviePreviewDetail | null;
export function selectTmdbTrailer(value: unknown, language: MoviePreviewLanguage): string | null;
```

Test NFC normalization, 100-character rejection, pages clamped to 1–20, positive safe movie IDs, `region=NZ`, language mapping, malformed payloads, unsafe poster paths, rating bounds, runtime bounds, and trailer preference.

- [ ] **Step 2: Run tests and confirm missing-module failure**

Run: `npx vitest run tests/movie-previews.test.ts tests/tmdb.test.ts`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement focused domain types**

Create types equivalent to:

```ts
export interface MoviePreview {
  id: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  releaseDate: string | null;
  rating: number | null;
  ratingCount: number;
}

export interface MoviePreviewDetail extends MoviePreview {
  runtimeMinutes: number | null;
  genres: string[];
  certification: string | null;
  trailerKey: string | null;
  tmdbUrl: string;
}
```

Implement parsers without type assertions to raw upstream shapes beyond `Record<string, unknown>` checks.

- [ ] **Step 4: Implement the server-only adapter**

Use `import "server-only"`, Bearer authorization, an eight-second abort timeout, and stable errors:

```ts
export type TmdbErrorCode =
  | "CONFIG_REQUIRED"
  | "UPSTREAM_NOT_FOUND"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_BUSY"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR";

export class TmdbClientError extends Error {
  constructor(public readonly code: TmdbErrorCode, public readonly status: number) {
    super(code);
    this.name = "TmdbClientError";
  }
}
```

Use `/3/movie/now_playing` when `query === null`, `/3/search/movie` otherwise, and `/3/movie/{id}?append_to_response=videos,release_dates` for details. Construct poster URLs only as `https://image.tmdb.org/t/p/w500/{validatedPath}`.

- [ ] **Step 5: Document the empty environment variable**

Append exactly:

```text
TMDB_READ_ACCESS_TOKEN=
```

- [ ] **Step 6: Run adapter tests**

Run: `npx vitest run tests/movie-previews.test.ts tests/tmdb.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add .env.example lib/movie-previews.ts lib/tmdb.ts tests/movie-previews.test.ts tests/tmdb.test.ts
git commit -m "feat: add validated TMDB movie adapter"
```

---

### Task 3: Add the movie-preview API contracts

**Files:**
- Create: `app/api/movie-previews/route.ts`
- Create: `app/api/movie-previews/[movieId]/route.ts`
- Create: `tests/movie-previews-route.test.ts`
- Create: `tests/movie-preview-detail-route.test.ts`

**Interfaces:**
- Consumes: `fetchTmdbMoviePreviews`, `fetchTmdbMovieDetail`, and public input parsers from Task 2.
- Produces: `{ movies, page }` list JSON and `{ movie }` detail JSON with controlled `{ error }` failures.

- [ ] **Step 1: Write route tests**

Mock `lib/tmdb.ts` before importing each route. Cover valid list, normalized search, invalid page fallback, valid detail, invalid ID 400, not found 404, missing configuration 503, quota 503, and generic upstream 502. Assert error bodies contain no upstream response or token.

- [ ] **Step 2: Run route tests and confirm missing-route failure**

Run: `npx vitest run tests/movie-previews-route.test.ts tests/movie-preview-detail-route.test.ts`

Expected: FAIL because the route modules do not exist.

- [ ] **Step 3: Implement list route**

Read `language`, `q`, and `page` from `request.nextUrl.searchParams`, normalize them, call the adapter, and map `TmdbClientError.status` to a short stable response:

```ts
return NextResponse.json({ error: error.code }, { status: error.status });
```

- [ ] **Step 4: Implement detail route**

Await `{ params }`, reject invalid `movieId` with 400, call the adapter, and return only normalized detail data.

- [ ] **Step 5: Run route and regression tests**

Run: `npx vitest run tests/movie-previews-route.test.ts tests/movie-preview-detail-route.test.ts tests/movies-route.test.ts`

Expected: PASS, proving `/api/movies` is unchanged.

- [ ] **Step 6: Commit**

```powershell
git add app/api/movie-previews tests/movie-previews-route.test.ts tests/movie-preview-detail-route.test.ts
git commit -m "feat: expose movie preview APIs"
```

---

### Task 4: Add poster-led movie discovery to `/movies`

**Files:**
- Create: `components/movie-poster.tsx`
- Create: `components/movie-preview-grid.tsx`
- Create: `components/tmdb-attribution.tsx`
- Create: `tests/movie-preview-grid.test.tsx`
- Modify: `components/movies-page-content.tsx`
- Modify: `tests/movies-page-content.test.tsx`
- Modify: `app/styles/movies.css`
- Modify: `app/styles/responsive.css`

**Interfaces:**
- Consumes: list API from Task 3 and `MoviePreview` from Task 2.
- Produces: a localized discovery grid whose cards link to `/movies/{id}`.

- [ ] **Step 1: Write component state tests**

Cover loading skeletons, ready cards, query-empty reset, unavailable retry, missing poster, image failure, Chinese labels, full title wrapping, and the route link:

```ts
expect(screen.getByRole("link", { name: /preview/i })).toHaveAttribute("href", "/movies/123");
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx`

Expected: FAIL because the preview components and fetch do not exist.

- [ ] **Step 3: Implement safe poster behavior**

Render a fixed 2:3 wrapper. On `onError`, replace the image with a quiet text fallback; never retry an invalid URL or collapse the card height.

- [ ] **Step 4: Implement list states and card semantics**

Use an `<article>` per movie, real `<Link>` elements for poster/title/action, localized release/rating labels, and one `role="status"` announcement for loading or empty states.

- [ ] **Step 5: Integrate preview fetch into the movie page**

Keep the screening request unchanged. Add a separate abortable request to:

```ts
`/api/movie-previews?language=${language}&q=${encodeURIComponent(activeQuery ?? "")}&page=1`
```

Render the preview grid before `MovieScreeningFeed`. Language and submitted query refresh previews; cinema filtering remains local.

- [ ] **Step 6: Add TMDB attribution**

Render the required notice exactly in English plus localized supporting text:

```text
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

- [ ] **Step 7: Add responsive CSS**

Use one movie column at 375px, two at 768px, and four at 1440px. Keep poster aspect ratio stable and interactive targets at least 44px.

- [ ] **Step 8: Run movie component tests**

Run: `npx vitest run tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx tests/movie-screening-feed.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add components/movie-poster.tsx components/movie-preview-grid.tsx components/tmdb-attribution.tsx components/movies-page-content.tsx app/styles/movies.css app/styles/responsive.css tests/movie-preview-grid.test.tsx tests/movies-page-content.test.tsx
git commit -m "feat: add New Zealand movie discovery"
```

---

### Task 5: Add the in-site movie detail and trailer experience

**Files:**
- Create: `app/movies/[movieId]/page.tsx`
- Create: `components/movie-detail-content.tsx`
- Create: `tests/movie-detail-content.test.tsx`
- Modify: `app/styles/movies.css`
- Modify: `app/styles/responsive.css`

**Interfaces:**
- Consumes: detail API from Task 3, `MoviePreviewDetail`, `CinemaDirectory`, `TmdbAttribution`, and language context.
- Produces: shareable `/movies/[movieId]` page with safe trailer or explicit no-trailer state.

- [ ] **Step 1: Write detail-state tests**

Cover loading, ready metadata, full overview, not found, retryable error, missing poster, missing overview, no trailer, and trailer embed. For a trailer key `Abc_123-x`, assert:

```ts
expect(screen.getByTitle(/trailer/i)).toHaveAttribute(
  "src",
  "https://www.youtube-nocookie.com/embed/Abc_123-x",
);
expect(screen.getByTitle(/trailer/i)).not.toHaveAttribute("src", expect.stringContaining("autoplay"));
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/movie-detail-content.test.tsx`

Expected: FAIL because the detail component does not exist.

- [ ] **Step 3: Implement localized detail request and states**

Fetch `/api/movie-previews/{movieId}?language={language}` with an abort controller. Map 404 to not found and other failures to retryable error without showing raw upstream messages.

- [ ] **Step 4: Implement detail content and trailer**

Render poster, title, original title, date, runtime, certification, genres, TMDB rating, full synopsis, and trailer. Validate the trailer key again before interpolation. Provide a no-trailer panel instead of an iframe when absent.

- [ ] **Step 5: Add cinema-directory continuation**

Below the movie metadata and trailer, render the existing Auckland directory with copy that tells users to confirm sessions on each official site. Do not label a cinema as showing the selected movie without a verified screening.

- [ ] **Step 6: Implement route shell and metadata**

Validate the path value before rendering `MovieDetailContent`. Use stable page metadata that does not require exposing the TMDB token.

- [ ] **Step 7: Style mobile and desktop layouts**

Use a single column at 375px and poster/content columns from 768px. Maintain a 16:9 trailer frame and clear keyboard focus.

- [ ] **Step 8: Run detail tests**

Run: `npx vitest run tests/movie-detail-content.test.tsx tests/movie-preview-detail-route.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add app/movies/[movieId] components/movie-detail-content.tsx app/styles/movies.css app/styles/responsive.css tests/movie-detail-content.test.tsx
git commit -m "feat: add in-site movie previews"
```

---

### Task 6: Browser journeys, accessibility, and complete regression

**Files:**
- Modify: `e2e/portal-interactions.spec.ts`
- Modify: relevant accessibility and bilingual tests under `tests/`
- Modify: CSS only if real browser evidence reveals a defect.

**Interfaces:**
- Consumes: completed movie and price-removal behavior.
- Produces: authoritative evidence for the release criteria.

- [ ] **Step 1: Add deterministic E2E API fixtures**

Intercept `/api/movie-previews*` with known English/Chinese movie data and detail/trailer responses. Keep real credentials out of tests.

- [ ] **Step 2: Add movie discovery journey**

Verify search, reset, poster fallback, in-site navigation, detail metadata, trailer/no-trailer behavior, required attribution, and official cinema links.

- [ ] **Step 3: Add price-absence journey**

Visit `/events`, a detail page, and `/saved`; assert the former price selectors and fallback strings do not exist.

- [ ] **Step 4: Add responsive and keyboard assertions**

For 375px, 768px, and 1440px, assert `scrollWidth <= clientWidth`, visible focus, and working primary actions.

- [ ] **Step 5: Run focused E2E**

Run: `npm run test:e2e -- --grep "movie preview|price-free"`

Expected: PASS.

- [ ] **Step 6: Run all verification commands**

Run in order:

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm run test:e2e
git diff --check origin/main...HEAD
```

Expected: all commands exit 0.

- [ ] **Step 7: Audit secrets and price removal**

Run:

```powershell
rg -n "TMDB_READ_ACCESS_TOKEN|Bearer " app components lib tests e2e --glob '!lib/tmdb.ts'
rg -n "priceRange|formatEventPrice|Price on official site|价格以官网为准|portal-event-price|event-detail-price" app components lib tests e2e
git status --short
```

Expected: first two commands have no forbidden matches; status contains only intentional tracked changes and the untouched untracked `skills-lock.json`.

- [ ] **Step 8: Review the final diff and commit repairs if needed**

Use `git diff origin/main...HEAD` to check scope, accessibility copy, route contracts, and environment handling. Commit only verified repair changes with:

```powershell
git add <exact-repair-files>
git commit -m "test: verify movie preview experience"
```

---

### Task 7: GitHub delivery and production configuration handoff

**Files:**
- No product file changes unless verification identifies a defect.

**Interfaces:**
- Consumes: verified branch history.
- Produces: pushed `feat/movie-previews`, ready PR, merged main, and a clear environment-variable handoff.

- [ ] **Step 1: Push the feature branch**

Run: `git push -u origin feat/movie-previews`

Expected: remote branch created without `skills-lock.json` or secrets.

- [ ] **Step 2: Create the ready pull request**

Use a PR title `feat: add New Zealand movie previews` and include verification commands, non-commercial TMDB boundary, price removal, and `TMDB_READ_ACCESS_TOKEN` deployment requirement.

- [ ] **Step 3: Inspect CI and review feedback**

Run: `gh pr checks --watch`

Expected: all required checks pass. Repair product issues before merge; never dismiss a failing check without evidence.

- [ ] **Step 4: Merge and verify remote state**

Merge only after checks pass, confirm the PR is merged, and confirm `origin/main` contains the implementation commits.

- [ ] **Step 5: Report the manual environment step**

The user must place their TMDB Read Access Token in Vercel as `TMDB_READ_ACCESS_TOKEN` for Production, Preview, and Development. Do not request that they paste the secret into chat.

---

## Plan self-review

- Every design requirement maps to Tasks 1–7.
- The existing `/api/movies` behavior remains independently tested.
- TMDB data and official cinema sessions have separate source responsibilities.
- No task requires a paid dependency or scraping.
- List and detail states include loading, ready, empty/not-found, missing media, and upstream failure.
- Trailer validation occurs at both normalization and render boundaries.
- Price removal includes domain types, upstream normalization, bookmarks, UI, CSS, tests, and browser assertions.
- The environment variable is server-only and the deployment handoff never asks the user to expose it in chat.
- Type and route names are consistent across tasks.
- No placeholders or deferred implementation steps remain.
