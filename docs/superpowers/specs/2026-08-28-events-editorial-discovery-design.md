# KiwiCue Events Editorial Discovery Redesign

**Date:** 2026-08-28

**Status:** Approved direction, implementation pending written-spec review

**Scope:** `/events`, `/events/[eventId]`, additive event-domain fields, and supporting tests/styles
**Project:** KiwiCue / nz news center

## 1. Context

KiwiCue already has a functional Auckland events feed, category navigation, saved events, bilingual presentation, and a detail route. The current events page is nevertheless difficult to browse because it presents a largely uniform stream. Categories act as a fixed runway instead of helping people answer practical questions such as “what is worth doing this weekend?”, “what fits my mood?”, or “what is near an area I know?” The current visual treatment also relies on rigid card borders and gives every item similar weight.

The redesign will turn the events surface into an editorial discovery product while preserving KiwiCue's core promise: useful local information without invented popularity, pricing, proximity, or editorial claims.

The design direction is informed by established patterns from Luma, Resident Advisor, Eventbrite, DICE, and Time Out. KiwiCue will adopt their useful interaction principles—searchable discovery, local editorial framing, direct event facts, and date-led browsing—without copying their branding, layouts, content, or assets.

## 2. Goals

1. Make the default `/events` page useful before a visitor knows what to search for.
2. Make explicit searches and filters fast, legible, shareable, and easy to clear.
3. Replace the rigid bordered grid with a distinctive editorial hierarchy that still scans well.
4. Make each event detail page answer what, when, where, admission status, and the next action above the fold whenever the source data supports those answers.
5. Preserve current routes, APIs, saved-event behavior, bilingual support, privacy boundaries, and trustworthy source attribution.
6. Scale to more events, categories, venues, and optional metadata without turning the page into a dense control panel.
7. Meet responsive, accessibility, SEO, loading, empty-state, error-state, and reduced-motion requirements.

## 3. Non-goals

- Do not add navigation destinations such as Guides or About unless real routes and content exist.
- Do not claim that an event is popular, trending, nearby, newly added, selling fast, or editorially recommended without an explicit trustworthy signal.
- Do not infer that an event is free merely because price data is missing.
- Do not add accounts, server-side saved-event profiles, location tracking, or background personalisation.
- Do not replace the current event providers or scrape third-party websites at runtime.
- Do not copy visual assets, wording, or brand identities from reference products.
- Do not make pricing restoration a prerequisite for shipping the discovery redesign.

## 4. Chosen Product Model: One Route, Two Modes

The same `/events` route will support two deliberate modes.

### 4.1 Discovery mode

Discovery mode is active when the URL contains no explicit user filter. The page behaves like a current Auckland culture guide rather than a search-results list. It includes:

- A compact editorial hero: `DISCOVER AUCKLAND` and `Find something worth doing.`
- A unified discovery control for keyword, date window, category, and venue.
- A lead-story composition with one large 16:9 event and up to two secondary events.
- Date-led sections with a strong `DAY / DATE / MONTH` visual marker.
- A “This weekend” collection when qualifying events exist.
- “Explore by mood” shortcuts, implemented as transparent combinations of existing categories and time windows rather than opaque recommendations.
- “Explore by category” with live result counts.
- “KiwiCue picks” only for events carrying an existing verified editorial preview or a recognised curated-market source.
- “Explore Auckland by area” only where a deterministic, documented area mapping can be derived from validated venue coordinates or known curated venue metadata.
- “Free things to do” only when a trusted provider reports an exact zero admission price or a curated record explicitly marks the event as free.

Any collection without sufficient truthful data is omitted. The layout must reflow naturally rather than leaving an empty shell.

### 4.2 Results mode

Results mode is active when the visitor applies a keyword, date window, category, or venue filter. Editorial collections that are unrelated to the active query disappear so the interface can focus on completion.

The results header includes:

- The query or human-readable filter summary.
- The currently loaded result count, worded so it does not imply an unknown total.
- Active filter chips with individual removal controls.
- A clear-all action.
- Sorting limited to `Recommended` and `Date`.

`Recommended` means a deterministic KiwiCue completeness ordering, not popularity. It favours valid upcoming time, useful imagery, venue clarity, source quality, and editorial completeness. `Date` is chronological. The UI must explain this distinction where ambiguity could mislead.

Results are grouped by local Auckland date. Desktop uses a compact filter surface; mobile opens the same controls in an accessible full-screen filter dialog. Filter values remain URL-backed so a result view can be bookmarked, shared, restored, and rendered consistently.

## 5. Information Architecture

The existing primary events navigation remains:

`Events → Picks → Movies → Saved`

No dead destination will be added for visual symmetry. Within `/events`, discovery shortcuts are controls and links into URL-backed result states, not new top-level routes.

The default page order is:

1. Page hero and unified discovery controls
2. Lead event composition
3. This weekend
4. Mood shortcuts
5. Category discovery
6. KiwiCue picks
7. Area discovery
8. Verified free events, when available
9. A chronological continuation feed

Sections may collapse or disappear based on data availability. The chronological continuation feed ensures the page remains useful even when enhanced metadata is sparse.

## 6. URL and Search State

The existing query contract remains compatible:

- `window`: `7d | weekend | 30d | all`
- `category`: an existing supported event category
- `keyword`: a sanitised search string
- `venueId`: a validated venue identifier

An additive `sort` parameter may be introduced with only `recommended | date`. Invalid or unsupported values fall back to `recommended` and are not echoed into UI or API requests.

The URL is the canonical source for explicit filters. Input updates should avoid excessive navigation: text search is submitted deliberately or debounced with cancellation; discrete filters update immediately. All query values are parsed through shared validators before they influence requests or rendering.

Discovery shortcuts produce the same valid URL state as direct filter controls. There is no separate hidden filtering system.

## 7. Event Domain and Truth Rules

`KiwiCueEvent` remains the stable public model. Optional additive metadata may be introduced only when it is validated at the provider boundary:

- `admission`: a discriminated value representing `free`, a verified price range and currency, or unknown.
- `areaId`: a KiwiCue-owned discovery area derived from validated coordinates or curated venue metadata.
- `organiserName`: only when supplied by the source.

Unknown values stay unknown and are omitted from the interface and structured data.

### 7.1 Featured ordering

Featured placement uses a deterministic score built only from observable data:

- Upcoming, valid Auckland time
- Usable landscape image
- Complete venue name and locality
- Official source link
- Existing editorial preview or curated source
- Sufficient descriptive metadata

This score is an internal presentation rule. It must never be labelled “popular” or “trending.” Stable tie-breaking uses start time and event id so server and client render consistently.

### 7.2 KiwiCue picks

An item qualifies only if it has an existing editorial preview or belongs to a specifically recognised curated source such as the verified market catalogue. Layout placement alone does not manufacture an editorial endorsement.

### 7.3 Areas

Area discovery uses a small, tested KiwiCue mapping such as Central, North, West, South, and East Auckland. Coordinates must be finite and within expected Auckland bounds before mapping. Curated venues may provide an explicit area. Area labels describe navigation groupings, not the user's distance or proximity.

### 7.4 Admission and free events

Admission data is progressive enhancement. A provider price range is accepted only when currency, numeric bounds, ordering, and source shape pass validation. `Free` requires an exact zero value from a trusted provider or an explicit curated flag. Missing price data is rendered as no admission label, never “Free” or “Price unavailable.”

## 8. Discovery Collections

Collection builders will be pure domain functions so their selection logic can be unit tested independently of React.

- `buildLeadSelection(events)` returns one lead and at most two secondary events without duplication.
- `groupEventsByAucklandDate(events)` groups using the Auckland timezone rather than the browser timezone.
- `buildWeekendCollection(events, now)` uses the existing window resolver and stable ordering.
- `buildCategorySummaries(events)` returns only supported categories with accurate counts from the loaded set.
- `buildEditorialPicks(events)` enforces the verified-pick rule.
- `buildAreaSummaries(events)` includes only validated mappings.
- `buildVerifiedFreeCollection(events)` enforces exact free-admission rules.

Collections share a de-duplication policy: the lead composition may be repeated later in the chronological continuation only if necessary for completeness, but compact editorial sections should avoid repeating the same event in adjacent modules.

All “count” labels must state or imply only what the client actually knows. Cursor-backed APIs must not present a loaded count as a global total.

## 9. Component Architecture

The implementation will separate domain selection from presentation.

### 9.1 `/events`

- `EventsPageContent`: owns page-level server/client composition and mode selection.
- `EventExplorer`: owns URL-backed filter state, fetch lifecycle, cursor pagination, cancellation, and result status.
- `EventDiscoveryHero`: renders the heading and unified controls.
- `EventFilterDialog`: provides the mobile full-screen filter experience with focus management and scroll locking.
- `EventLeadStory`: renders the asymmetric lead composition.
- `EventDateGroup`: renders one date marker and its event list.
- `EventDiscoverySection`: provides a consistent section heading/action contract without forcing identical card layouts.
- `EventMoodLinks`, `EventCategoryLinks`, and `EventAreaLinks`: render transparent shortcuts into URL-backed results.
- Existing bookmark/save controls remain the single implementation for local saved state.

The precise file split may reuse or rename existing components where that produces a clearer result. Components should remain focused, with complex selection and parsing outside React.

### 9.2 `/events/[eventId]`

- Server route resolves metadata and the initial event when practical.
- `EventDetailContent` renders a two-column artwork/facts hero on desktop and a redesigned single-column hierarchy on mobile.
- Fact rows render only validated values.
- Related events use a pure deterministic selector based on category, venue, and time, without implying personalisation or popularity.
- The existing save mechanism remains browser-local.

## 10. Data Flow and Failure Handling

### 10.1 List flow

1. Parse and validate URL state.
2. Request the existing events API with supported filters and cursor.
3. Normalize all provider data at the server boundary.
4. Render discovery collections or focused results from the same normalized event set.
5. Append later cursor pages without duplicating ids.
6. Abort stale requests when filters change.

The list provides:

- A content-shaped loading state that reflects the active mode.
- A specific recoverable error state with retry.
- A filter-aware empty state with clear/reset actions.
- A no-JavaScript/server-rendered useful shell where supported by the current architecture.

### 10.2 Detail flow

1. Validate the event id before provider access.
2. Fetch and normalize the event on the server where compatible with the current API boundary.
3. Return not-found semantics for missing events and a specific recoverable state for provider failures.
4. Render only safe text and allowlisted external URLs.
5. Load related events independently so their failure does not hide the primary event.

External ticket/source actions open the official provider in a clearly labelled new context, include safe `rel` attributes, and never imply that KiwiCue completes the transaction.

## 11. Event Detail Experience

The detail hero follows a direct DICE-like information hierarchy without copying its visual identity:

- Artwork on the left and essential facts on the right at wide sizes.
- Category eyebrow, title, Auckland-local date/time, venue, address, verified admission, and primary source action.
- Save as a secondary action.
- Clear source attribution close to the primary action.

Below the fold:

1. About
2. Date and time
3. Location
4. Organiser, when known
5. Official source
6. More like this

Optional sections disappear cleanly. Placeholder copy must not be substituted for absent descriptions, organisers, prices, or addresses.

## 12. SEO and Structured Data

`/events/[eventId]` will use dynamic metadata when the server can resolve the event:

- A concise event-specific title
- A description derived from validated event facts or editorial preview
- Canonical route
- Open Graph title, description, and image when safe

The page may emit schema.org `Event` JSON-LD with only validated fields:

- `name`
- `startDate`
- `eventStatus`
- `url`
- `image`
- `location`
- `organizer`
- `offers` only for verified admission information

JSON-LD is serialized through a safe helper that prevents script-breaking sequences. Unsupported fields are omitted rather than guessed. Provider URLs are validated before inclusion.

## 13. Visual System

The events surface will use a warm editorial system:

- Warm neutral canvas, near-black ink, and KiwiCue green as the single functional accent.
- A locally hosted editorial display face paired with the current readable sans-serif. No external font request is required.
- Strong type scale, date numerals, whitespace, and imagery to create hierarchy.
- Fine neutral dividers only where they clarify grouping; no black box border around each card or the full content runway.
- Square-to-moderate corner radii, restrained shadows, and no glassmorphism, neon gradients, or oversized rounded pills.
- Asymmetric lead layout on desktop, balanced two-column tablet layouts, and deliberately recomposed mobile cards rather than simple shrinking.

Motion is limited to purposeful 150–250 ms transitions for filter feedback, card emphasis, and dialog entry. `prefers-reduced-motion` removes nonessential movement. Images reserve aspect ratios to avoid layout shift.

## 14. Responsive Behaviour

- **375–639 px:** single-column content, horizontally efficient date markers, full-screen filter dialog, reachable controls, and no clipped text or horizontal page overflow.
- **640–1023 px:** two-column supporting stories and event grids, inline primary controls with overflow handled intentionally.
- **1024 px and above:** asymmetric lead composition, compact desktop filter surface, and wider date-led group layouts.

Touch targets are at least 44 CSS pixels where practical. Sticky controls must not obscure content, browser UI, or focused elements.

## 15. Accessibility and Bilingual Behaviour

- One descriptive `h1`; subsequent headings follow a logical hierarchy.
- All controls have visible labels or reliable accessible names.
- Active filters expose selected state and removable chips expose their full action.
- The mobile filter dialog traps focus, closes with Escape, restores focus, and labels its purpose.
- Dynamic result status uses restrained live-region announcements.
- Keyboard focus is visible against every background.
- Colour is never the only category, status, or selection signal.
- Text and functional controls meet WCAG 2.2 AA contrast targets.
- English and Chinese strings continue through the existing locale mechanism. Layouts tolerate longer English or Chinese copy without fixed-height clipping.
- Dates and times use Auckland semantics and locale-aware formatting.

## 16. Privacy and Security

- Saved events remain browser-local unless a separately approved account system is introduced.
- No precise visitor location is requested for area discovery.
- All query parameters are validated and bounded.
- External URLs use an allowlist or strict `http/https` validation and safe link attributes.
- Third-party response text is rendered as text, not injected HTML.
- API credentials remain server-only environment variables.
- Structured data serialization prevents closing-script injection.
- No password, API key, token, or private user data is written to logs, fixtures, documentation, or Obsidian.

## 17. Performance

- Preserve cursor pagination and avoid requesting the entire catalogue.
- Keep collection builders linear or near-linear over the loaded set.
- Memoize derived collections only where profiling or render frequency justifies it.
- Use responsive image sizes and existing Next image optimisation rules.
- Avoid a new UI framework or animation dependency for this redesign.
- Prevent duplicate API requests during URL synchronization.
- Keep the primary event facts usable if related-event or optional metadata requests fail.

## 18. Testing Strategy

Implementation follows test-driven development.

### 18.1 Baseline repair

The current baseline has 302 passing tests and 16 suites that fail during import because `vitest.config.ts` aliases `server-only` to the removed Next internal path `next/dist/compiled/server-only/empty.js`. Before feature work, replace that brittle internal alias with a repository-owned empty test stub and prove the entire baseline passes. This is a test-infrastructure compatibility repair, not a product change.

### 18.2 Unit and component coverage

- URL parsing, serialization, invalid-value fallback, and clear-all behaviour
- Stable featured scoring and tie-breaking
- Auckland date grouping across timezone/day boundaries
- Verified editorial-pick, area, and free-admission eligibility
- De-duplication across cursor pages and discovery modules
- Discovery/results mode switching
- Loading, empty, retry, and partial-failure states
- Filter dialog keyboard and focus behaviour
- Save controls and bilingual labels
- Detail optional-field omission, source link safety, related-event selection, metadata, and JSON-LD

### 18.3 Integration and visual checks

- Existing API and route contract tests remain green.
- Production build and lint pass.
- Desktop, tablet, and 375 px mobile screenshots cover discovery, filtered results, no-results, detail, and at least one error/loading state.
- Browser checks cover keyboard-only filters, dialog focus, reduced motion, long titles, missing images, missing admission, and Chinese locale.
- No horizontal overflow, black card runway border, overlapping control, or layout shift regression is accepted.

## 19. Delivery Plan

Implementation will be split into two detailed TDD plans under this single product goal.

### Plan A: Events discovery and results

- Repair the `server-only` test stub and restore a green baseline.
- Add pure discovery derivation and optional validated metadata contracts.
- Build dual-mode `/events` composition.
- Build URL-backed sorting and filter removal.
- Build desktop/mobile filter surfaces and all states.
- Replace rigid card borders with the editorial responsive system.
- Add unit, component, integration, accessibility, and screenshot verification.

### Plan B: Event detail, related events, and SEO

- Move essential detail resolution toward the server boundary without breaking current APIs.
- Build the artwork/facts hero and optional sections.
- Add deterministic related events.
- Add dynamic metadata and safe Event JSON-LD.
- Verify external actions, missing data, responsive layouts, locale behaviour, and accessibility.

Each plan will use small red-green-refactor increments. Feature commits will be clear and scoped. The completed branch will be self-reviewed, reviewed by a code-review agent as requested, pushed, opened as a pull request, and merged only after checks are green. The English Obsidian project memory will then be updated with durable decisions, implementation outcomes, pitfalls, and reusable techniques.

## 20. Acceptance Criteria

- The default `/events` page feels editorial and exploratory rather than like a uniform database grid.
- Applying any explicit filter produces a focused, URL-backed results experience.
- Category, mood, area, pick, and free collections never exceed what the available data can truthfully support.
- Black box borders are removed from the event runway and card system.
- The design remains useful when optional metadata is missing.
- `/events/[eventId]` exposes essential trustworthy facts and a clear official-source action above the fold.
- Existing routes, APIs, saves, bilingual support, and privacy behaviour remain compatible.
- Loading, empty, error, retry, and partial-failure states are complete.
- Keyboard, screen-reader, reduced-motion, and 375 px mobile checks pass.
- Unit tests, integration tests, lint, and production build pass from a clean checkout.
- The final PR contains no secrets, temporary assets, unrelated workspace files, or fabricated event claims.
