# Event Categories and Recommendations Design

## Outcome

KiwiCue will turn event discovery from a flat chronological list into two complementary paths:

1. A clearer category-led events page where users can immediately understand and combine event type, date, keyword, and venue filters.
2. A new bilingual `/recommendations` page that selects a small, varied set of useful Auckland plans and explains why each item was chosen.

The feature must be genuinely useful without accounts, analytics, invented popularity, paid data, or hidden personal-data processing.

## Current problem

The events page already exposes four category links, but they are visually presented as compact filter pills with no descriptions. A user scanning the page cannot quickly understand the difference between the choices or confidently start browsing. The feed then calls its first chronological item a “quickest pick,” even though no recommendation logic has been applied.

KiwiCue also has no place that answers a higher-level question such as “what should I do this weekend?” or “show me a few good options without making me inspect every category.”

## Approaches considered

### 1. Restyle the current category pills and add a static recommendations page

This is inexpensive, but it does not improve selection quality. A static page would become stale and would not respond to live event availability or the user’s saved-event interests.

### 2. Deterministic, explainable recommendations using existing event data

This is the selected approach. KiwiCue ranks validated upcoming events using truthful signals it already owns: date proximity, on-sale or verified status, venue and media completeness, category diversity, weekend fit, and optional affinity inferred from browser-local saved events. The page shows the reason for every recommendation and never claims popularity it cannot measure.

### 3. Account-based behavioural recommendations

Accounts, tracking, server-side profiles, and collaborative filtering could eventually improve personalization, but they would create privacy, security, moderation, and cold-start work disproportionate to the current product. This option is excluded.

## Event category experience

### Category set

The public category set becomes:

- All events
- Concerts
- Theatre
- Markets
- Festivals
- Sports

Sports uses Ticketmaster’s `Sports` classification. The other existing filters retain their current provider mapping, including KiwiCue’s curated market source.

### Interaction design

The existing category pills become a compact category-card grid inside the filter panel. Every card contains:

- A short stable code used as visual orientation, not as the accessible name.
- The bilingual category label.
- A one-line description of the kinds of plans found there.
- A strong selected state with `aria-current="page"`.

Changing category preserves the selected time window, keyword, and venue. “All events” removes only the category. The time-range control remains compact so category selection is visually primary.

At 375px, the category cards remain at least 44px high, use a two-column grid, and never require horizontal scrolling. The “All events” card spans both columns because it is the reset and discovery entry point. Larger screens use three or six columns according to available width.

### Feed language

The general event feed no longer calls the first chronological item a recommendation. It describes the list as date ordered. Visual emphasis on the first card may remain as editorial hierarchy, but its copy must not imply ranking intelligence.

## Recommendation page

### Information architecture

The global header adds a fourth destination between Events and Movies:

- English: `Picks`
- Chinese: `推荐`

The new `/recommendations` page uses this order:

1. A concise masthead explaining that recommendations are transparent and based on upcoming Auckland listings.
2. A preference note that changes when saved events are available, explaining that saved-event matching happens only in the browser.
3. “Start here” / “从这里开始”: up to three strongest, category-diverse recommendations.
4. “This weekend” / “这个周末”: up to four eligible weekend events.
5. “Try something different” / “换个口味”: up to four category-diverse options outside the user’s dominant saved category, or a broad mix when there are no saves.
6. Category shortcuts linking back to pre-filtered event results.
7. A source and accuracy note.

Sections with no qualifying events are omitted rather than rendered as empty chrome. If only one source succeeds, the page remains usable with a non-blocking partial-data notice.

### Data loading

The client requests two existing public, read-only feeds in parallel:

- `/api/events?window=30d&size=50` for general Ticketmaster events.
- `/api/events?window=30d&category=markets&size=50` for KiwiCue-verified markets.

Results are validated by the existing API layer, merged by event ID, and passed to a pure recommendation module. Existing HTTP caching remains in effect. No new upstream provider, credential, database, or write endpoint is introduced.

### Recommendation signals

`lib/event-recommendations.ts` provides deterministic pure functions. It scores events using only observable facts:

- Upcoming within seven days: strong positive signal.
- Falls within the current Auckland weekend window: positive signal for the weekend section.
- `onsale` or `schedule_verified`: positive confidence signal.
- Has a venue: small completeness signal.
- Has a usable image or curated editorial preview: small completeness signal.
- Matches a category or venue represented in the user’s saved events: personalization signal.
- Already saved: excluded from “new recommendation” sections.
- Cancelled, postponed, rescheduled, off-sale, invalid, or already past: excluded.

Tie-breaking is stable: earliest date/time, then normalized name, then ID. Selection enforces category and venue diversity so one promoter, venue, or event type cannot dominate the first screen.

### Recommendation reasons

Every rendered recommendation receives one short reason chosen from verified signals, for example:

- “Matches events you saved” / “与你收藏的活动相似”
- “A strong option for this weekend” / “适合这个周末”
- “Happening within the next seven days” / “未来七天内举行”
- “KiwiCue-verified local schedule” / “KiwiCue 已核实本地日程”
- “A well-detailed upcoming event” / “信息完整的近期活动”

The UI must not use “popular,” “trending,” “best-selling,” “near you,” or similar claims without supporting data.

### Privacy

Saved-event affinity is calculated in the browser from the existing bookmark context. Saved events, category preferences, and venue preferences are never sent to KiwiCue or another provider. The page works without any saves and never asks for location.

## Components and boundaries

- `lib/event-categories.ts`: public category IDs and parsing, including sports.
- `components/event-category-nav.tsx`: descriptive category-card navigation shared by Events and recommendation shortcuts where appropriate.
- `lib/event-recommendations.ts`: filtering, scoring, reason selection, and diversity selection; no React or network code.
- `app/recommendations/page.tsx`: page metadata and route shell.
- `components/recommendations-page-content.tsx`: loading, partial, ready, empty, and error orchestration.
- `components/recommendation-card.tsx`: accessible event presentation with recommendation reason and bookmark action.
- `components/recommendation-skeleton.tsx`: layout-stable loading state.
- `components/portal-header.tsx`: Picks navigation, current-page state, and skip target.
- `app/styles/recommendations.css`: page-specific presentation imported from `app/globals.css`.

The recommendation card may reuse event display helpers, editorial media, and bookmark controls, but it must not make the existing `EventCard` accept recommendation-only conditionals.

## States and failure handling

### Loading

Show a polite status and fixed-size skeletons that match the final card geometry. Do not show a spinner-only blank page.

### Ready

Render only non-empty sections and state how many sources contributed. Recommendation reasons remain visible text, not tooltips.

### Partial

If either the general or market request fails, render recommendations from the successful source and show a non-blocking bilingual notice with a retry action.

### Empty

Explain that no eligible recommendation is currently available, then present category shortcuts and a direct link to all events.

### Error

If both requests fail, show a specific bilingual error, retry action, and links to the existing Events and Saved pages. Never expose provider response bodies, credentials, or stack traces.

## Accessibility and responsive behaviour

- All category cards, header destinations, recommendation links, bookmark buttons, and retry controls have at least a 44×44px target.
- Navigation uses real links and the current destination uses `aria-current="page"`.
- Loading uses `role="status"` and `aria-busy`; errors use `role="alert"`; partial failure is a polite status.
- Recommendation cards have one clear internal-details link plus the separate bookmark button.
- Focus order matches visual order, focus styles remain visible, and reduced motion disables nonessential transforms.
- There is no horizontal overflow at 375px, 768px, or 1440px.
- Header navigation remains usable with four destinations at 375px; labels may compact but may not fall below the minimum target size.

## Testing strategy

Unit tests cover:

- Sports category parsing and Ticketmaster URL mapping.
- Event eligibility, stable scoring, saved-event affinity, exclusion of saved and unavailable events, reason selection, weekend selection, and category/venue diversity.
- Stable tie-breaking and invalid-date handling.

Component tests cover:

- Descriptive category cards in English and Chinese.
- Preservation of all other filters when category changes.
- Recommendation loading, personalized ready, non-personalized ready, partial, empty, error, retry, and language-switch states.
- Header order, current-page state, bookmark action separation, and truthful recommendation copy.

Playwright covers:

- Selecting Sports and returning to All while time/search filters are preserved.
- Opening Picks, viewing transparent reasons, switching language, bookmarking a recommendation, and seeing local-personalization copy update.
- Partial-source failure and retry.
- Keyboard navigation and horizontal-overflow checks at 375px, 768px, and 1440px.

The implementation is complete only after targeted tests, `npm test`, `npm run lint`, `npm run build`, and the existing end-to-end suite pass, followed by visual inspection of Events and Picks at the three target widths.

## Delivery and scope

- Work occurs on a dedicated feature branch created from `main` without the unrelated `skills-lock.json`.
- The PR includes the design, implementation plan, implementation, tests, and user-facing README updates if navigation or features documented there change.
- GitHub checks must pass before merge. The PR is merged only after verification; no force push is used.
- The feature does not add accounts, analytics, notifications, paid services, location tracking, event scraping, or unverified claims.
- Additional improvements are allowed only when they directly support category discovery, recommendation usability, accessibility, responsive layout, or truthful data presentation.
