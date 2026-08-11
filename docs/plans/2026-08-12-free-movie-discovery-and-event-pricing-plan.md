# Free Movie Discovery and Event Pricing Implementation Plan

**Goal:** Add a zero-cost bilingual Auckland movie hub with a legal open-feed fallback, and show trustworthy Ticketmaster price ranges across the event experience.

**Architecture:** Ticketmaster prices are normalized into the existing event domain model. Movie screenings use a focused server adapter for Open Cinema Platform and a local factual cinema directory that remains useful when the feed is empty or unavailable. Client components consume only KiwiCue-owned normalized types and never receive provider credentials.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS modules-by-import, Vitest, Testing Library, Playwright.

## Global constraints

- No paid API, unlicensed scraping, seat selection, payment, user accounts, or new UI dependency.
- No secret may appear in browser code, Git, logs, or screenshots.
- Validate every upstream field and every public query parameter.
- English and Chinese must work without a refetch when only language changes.
- Main controls are at least 44×44px and the 375px layout has no horizontal overflow.
- Missing prices are labelled as unavailable from the source; prices are never estimated.
- `skills-lock.json` remains untracked.

---

### Task 1: Ticketmaster price domain

**Files:**
- Create: `lib/event-price.ts`
- Create: `tests/event-price.test.ts`
- Modify: `lib/events.ts`
- Modify: `lib/ticketmaster.ts`
- Modify: `tests/ticketmaster-client.test.ts`

**Interfaces:**
- `KiwiCuePriceRange = { currency: string; minimum: number; maximum: number }`
- `normalizePriceRanges(input: unknown): KiwiCuePriceRange | null`
- `formatEventPrice(range: KiwiCuePriceRange | null, language: Language): string`
- `KiwiCueEvent.priceRange: KiwiCuePriceRange | null`

- [x] Write failing formatter tests for `NZ$49`, `NZ$49–129`, decimal preservation, ISO currency fallback, and localized missing-price copy.
- [x] Run `npm test -- tests/event-price.test.ts`; expect failure because `lib/event-price.ts` does not exist.
- [x] Implement bounded currency and finite non-negative range formatting in `lib/event-price.ts`.
- [x] Run the focused formatter test and expect all cases to pass.
- [x] Add failing Ticketmaster normalization tests using `priceRanges` with valid, reversed, negative, and non-finite values.
- [x] Run `npm test -- tests/ticketmaster-client.test.ts`; expect the valid payload to lack `priceRange`.
- [x] Extend the payload type, event domain type, and normalizer so the first valid standard range becomes `priceRange`, otherwise `null`.
- [x] Run both focused tests and expect success.
- [x] Commit `feat: normalize Ticketmaster event prices`.

### Task 2: Price presentation and saved-event compatibility

**Files:**
- Modify: `app/events/event-card.tsx`
- Modify: `components/event-detail-content.tsx`
- Modify: `components/saved-page-content.tsx`
- Modify: `lib/bookmarks.ts`
- Modify: `tests/event-card.test.tsx`
- Modify: `tests/event-detail-content.test.tsx`
- Modify: `tests/saved-page-content.test.tsx`
- Modify: `tests/bookmarks.test.ts`
- Modify: `app/styles/events.css`
- Modify: `app/styles/detail-saved.css`

**Interfaces:**
- Consumes `formatEventPrice` and `KiwiCueEvent.priceRange` from Task 1.
- Existing serialized version 1 bookmarks without `priceRange` parse as `priceRange: null`.

- [x] Add failing card tests asserting a real range and missing-price label appear between venue and category metadata.
- [x] Add failing detail tests asserting price is visible beside primary booking information.
- [x] Add failing saved tests asserting price remains visible after persistence.
- [x] Add a failing bookmark migration test using an old version 1 payload without `priceRange`.
- [x] Run the four focused test files and confirm failures are caused by absent price UI and parser rejection.
- [x] Update the bookmark parser to accept a missing field as `null` and validate supplied currency/minimum/maximum values.
- [x] Render localized price text in card, detail, and saved paths using one formatter.
- [x] Add restrained `.event-price` and `.event-detail-price` styles using existing tokens.
- [x] Run the four focused tests and expect success.
- [x] Commit `feat: show event price ranges`.

### Task 3: Auckland cinema directory

**Files:**
- Create: `lib/cinema-directory.ts`
- Create: `tests/cinema-directory.test.ts`

**Interfaces:**
- `AucklandCinema = { id; name; chain; suburb; address; coordinates; sessionsUrl }`
- `filterCinemas(cinemas, query): AucklandCinema[]`
- `sortCinemasByDistance(cinemas, origin): Array<AucklandCinema & { distanceKilometres: number }>`

- [x] Add failing tests for unique ids, HTTPS official links, valid Auckland coordinates, case/diacritic-insensitive matching, blank-query ordering, and nearest-first sorting.
- [x] Run `npm test -- tests/cinema-directory.test.ts`; expect module-not-found failure.
- [x] Add a small verified directory for major Auckland chains and independent cinemas; store facts only, never sessions or prices.
- [x] Implement normalized matching across name, chain, suburb, and address using the same Unicode rules for data and query.
- [x] Reuse `distanceKm` from `lib/distance.ts` for sorting without requesting location.
- [x] Run the directory tests and expect success.
- [x] Commit `feat: add Auckland cinema directory`.

### Task 4: Open Cinema normalization client

**Files:**
- Create: `lib/movies.ts`
- Create: `lib/open-cinema.ts`
- Create: `tests/open-cinema.test.ts`

**Interfaces:**
- `MovieDateFilter = "today" | "tomorrow" | "weekend" | "all"`
- `KiwiCueScreening = { id; filmId; filmTitle; cinemaId; cinemaName; startTime; formats; soldOut; distanceKilometres; bookingUrl }`
- `fetchAucklandScreenings({ query, date, now, fetchImpl, apiKey }): Promise<KiwiCueScreening[]>`
- `OpenCinemaClientError` with stable `UPSTREAM_BUSY | UPSTREAM_TIMEOUT | UPSTREAM_ERROR` codes.

- [x] Add failing URL tests for Auckland coordinates, 100km radius, `title`, and ISO `date` mapping.
- [x] Add failing normalization tests for safe screenings and rejection of missing ids/title/time, malformed dates, unsafe checkout URLs, invalid distance, and oversized strings.
- [x] Add failing fetch tests for timeout and non-200 responses.
- [x] Run `npm test -- tests/open-cinema.test.ts`; expect module-not-found failure.
- [x] Implement a server-only client with an 8-second abort timeout, optional bearer header, defensive JSON typing, 50-result limit, and deduplication by screening id.
- [x] Keep all times in their upstream ISO form; presentation converts them with `Pacific/Auckland` locale options.
- [x] Run the focused client tests and expect success.
- [x] Commit `feat: add open cinema client`.

### Task 5: Public movie API route

**Files:**
- Create: `app/api/movies/route.ts`
- Create: `lib/movie-search-params.ts`
- Create: `tests/movie-search-params.test.ts`
- Create: `tests/movies-route.test.ts`

**Interfaces:**
- `parseMovieQuery(value): string | null` returns a whitespace-normalized string up to 100 characters.
- `parseMovieDateFilter(value): MovieDateFilter` defaults to `today` and rejects duplicates through route logic.
- Response: `{ screenings: KiwiCueScreening[]; source: "open-cinema"; sourceState: "ready" | "empty" | "unavailable" }`.

- [x] Add failing query-parser tests for Unicode normalization, repeated whitespace, empty input, arrays, and overlong values.
- [x] Add failing route tests for one canonical query/date, duplicate parameters, empty feed, upstream failure degradation, and `no-store` response caching.
- [x] Run both focused files and confirm failures are from missing modules.
- [x] Implement parsers without `any`, then implement dependency-injected `handleMoviesRequest` and `GET`.
- [x] Treat upstream failure as HTTP 200 with `sourceState: "unavailable"` because the directory is still available; invalid public input returns HTTP 400.
- [x] Run both focused tests and expect success.
- [x] Commit `feat: expose free movie screening feed`.

### Task 6: Movie page, navigation, and bilingual interaction

**Files:**
- Create: `app/movies/page.tsx`
- Create: `components/movies-page-content.tsx`
- Create: `components/movie-screening-feed.tsx`
- Create: `components/cinema-directory.tsx`
- Create: `components/movie-search-panel.tsx`
- Modify: `components/portal-header.tsx`
- Modify: `tests/portal-navigation.test.tsx`
- Create: `tests/movies-page-content.test.tsx`
- Create: `tests/movie-screening-feed.test.tsx`

**Interfaces:**
- `PortalPage` gains `"movies"`.
- `MoviesPageContent` owns URL state, feed state, directory filter, and opt-in location state.
- `MovieScreeningFeed` is presentational and never fetches.
- `CinemaDirectory` receives already filtered/sorted entries and optional distances.

- [ ] Add failing navigation tests for Events, Movies, Saved order, `aria-current`, real hrefs, and Chinese labels.
- [ ] Add failing movie-page tests for loading, populated, empty, unavailable, reset, and language-switch states.
- [ ] Add failing screening-card tests for time, formats, sold-out state, distance, and safe official booking links.
- [ ] Run the three focused files and confirm expected missing-UI failures.
- [ ] Add `/movies` metadata and client content using a single labelled search form plus today/tomorrow/weekend/all buttons.
- [ ] Fetch `/api/movies` only when query/date state changes; abort stale requests and keep the directory visible throughout.
- [ ] Add opt-in geolocation once per click, never persist coordinates, and sort directory results nearest-first after success.
- [ ] Update the global header and skip-link target union for the movie page.
- [ ] Run the focused tests and expect success.
- [ ] Commit `feat: add bilingual Auckland movie hub`.

### Task 7: Visual system and responsive browser coverage

**Files:**
- Create: `app/styles/movies.css`
- Modify: `app/globals.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/editorial-design-system.test.ts`
- Modify: `e2e/portal-interactions.spec.ts`

**Interfaces:**
- Movie styles use only existing color, radius, shadow, focus, spacing, and typography tokens.
- Playwright route fixtures intercept `/api/movies` and external official URLs.

- [ ] Add failing CSS-contract tests for the movie stylesheet import, 8px controls, 12px panels, 44px targets, `100dvh`, and no new hard-coded palette.
- [ ] Add a failing Playwright movie journey covering search, date change, location opt-in, official link, language switch, focus, and no overflow.
- [ ] Run the focused CSS test and Playwright movie test; confirm failures are from missing selectors/UI.
- [ ] Implement a compact editorial movie layout: one-column mobile, two-column tablet, three-column desktop, with restrained separators instead of nested cards.
- [ ] Add skeletons that match screening rows, inline warnings, and clear empty states.
- [ ] Run the focused CSS and Playwright tests and expect success at 375px, 768px, and 1440px.
- [ ] Commit `feat: polish responsive movie discovery`.

### Task 8: Repository workflow and release verification

**Files:**
- Modify only files required by failures discovered during verification.

- [ ] Create one GitHub issue for free movie discovery and one for event pricing; assign both to `hannnnnnnny`.
- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run lint` and require zero errors.
- [ ] Run `npx tsc --noEmit` and require exit code 0.
- [ ] Run `npm run build` and require exit code 0.
- [ ] Run `npm run test:e2e` and require every configured project to pass.
- [ ] Run `git diff --check`, inspect `git diff origin/main...HEAD`, and confirm `skills-lock.json` is not staged.
- [ ] Push `feat/free-movie-discovery`, open a ready PR with `Closes #<movie>` and `Closes #<pricing>`, and wait for required checks.
- [ ] Merge the PR, confirm both issues are closed, and confirm production deployment status without triggering paid services.
