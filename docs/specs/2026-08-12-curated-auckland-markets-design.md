# Curated Auckland Markets

## Outcome

KiwiCue will replace the empty Ticketmaster-backed `Markets` result with a zero-cost, KiwiCue-owned directory of recurring Auckland markets. The directory will use basic schedule facts from official organiser pages, KiwiCue-written summaries, and links back to those pages. It will not use Eventfinda content, copy third-party descriptions or images, require another API key, or add paid infrastructure.

The first release solves one focused problem: selecting `Markets` must immediately return useful, current Auckland options that continue to work with the existing date, keyword, venue, detail, map, distance, bookmark, and bilingual interfaces.

## Confirmed boundaries

### Included

- Recurring market series whose current schedules are published by their organisers.
- The seven active Auckland Night Markets locations listed by Auckland Night Markets.
- Avondale Sunday Market, Grey Lynn Farmers Market, and Catalina Bay Farmers Market.
- Dynamic calculation of the next occurrence in `Pacific/Auckland`, including daylight-saving changes.
- Existing `7d`, `weekend`, `30d`, and `all` date windows.
- Keyword and curated-venue filtering within the `Markets` category.
- Internal detail pages, official links, bookmarks, addresses, maps, and distance when verified coordinates are available.
- Source organisation, official source URL, and last-verified date on curated event details.
- English and Chinese interface copy explaining the curated source.
- Curated market names in search suggestions when the Markets category is active.
- Curated venues in the venue selector.

### Excluded

- Eventfinda API content, because its current developer terms prohibit aggregation with other event sources.
- Scraping or periodically crawling organiser websites.
- Copying organiser descriptions, photographs, logos, or other creative content.
- Inventing coordinates, dates, exceptions, prices, or closure information.
- Assuming a recurring market runs on public holidays or exceptional closure dates when the organiser has not confirmed that.
- Adding accounts, public submissions, moderation, or an admin CMS in this feature.
- Mixing curated records into Ticketmaster's general paginated feed in this release.

## Options considered

### 1. Merge curated records into every Ticketmaster page

This would make markets visible in the unfiltered feed, but the existing Ticketmaster cursor cannot describe the position of local records. Merging only on the first page would make totals, ordering, and load-more behavior misleading. Replacing the cursor with a cross-source cursor is disproportionate for the first curated release.

### 2. Build public event submission and moderation first

This is the long-term growth path, but it requires identity, spam controls, validation, moderation state, audit history, and an operator workflow. It does not solve the current empty page as quickly or safely.

### 3. Route the Markets category to a dedicated curated adapter

This is the selected approach. It gives the category truthful totals and deterministic filtering without touching Ticketmaster pagination or quota behavior. The adapter implements the same KiwiCue event contract, so details, bookmarks, maps, distance, and cards remain shared.

## Source policy

Each market definition contains only:

- A stable KiwiCue ID.
- Market and venue names.
- Weekday and opening time.
- Street address and postal code when the organiser or venue publishes them.
- Coordinates only after the address is verified.
- The organiser's HTTPS page.
- A concise original KiwiCue summary in English and Chinese.
- The date KiwiCue last verified the schedule.

Images remain `null` until KiwiCue has a licensed local asset or written permission. The existing branded fallback is used instead of hotlinking organiser media.

The initial source registry uses:

- Auckland Night Markets: `https://www.aucklandnightmarkets.co.nz/locations`
- Avondale Sunday Market: `https://www.avondale.net.nz/avondale-sunday-market`
- Grey Lynn Farmers Market: `https://www.greylynnfarmersmarket.co.nz/`
- Catalina Bay Farmers Market: `https://www.catalinabay.co.nz/farmers-market`

## Data architecture

### Curated definitions

`lib/curated-markets.ts` owns immutable market definitions and recurrence generation. A definition includes one or more weekday schedules. It does not fetch the network at runtime.

The recurrence calculator receives an explicit `now` for deterministic tests. It converts `now` to `Pacific/Auckland`, chooses today only when the published start time has not passed, otherwise advances to the next matching weekday, and returns a real ISO instant plus local date and time. A market appears once at its nearest upcoming occurrence; the detail explains its recurring schedule. This avoids an endless grid of duplicate weekly cards.

### Filtering

The curated adapter accepts the same normalized filter values as the event route:

- `window`
- `keyword`
- `venueId`
- `size`

Keyword matching is case-insensitive over market name, venue name, and KiwiCue summaries. Venue IDs use the existing safe ID grammar. Date-window filtering compares the generated instant with the existing `resolveEventWindow` boundaries. Results are sorted chronologically, then by name for stable ties.

The adapter returns the existing `AucklandEventsResult` shape with no continuation cursor because the curated catalogue is intentionally bounded.

### Source routing

`GET /api/events` routes `category=markets` to the curated loader. Other categories and the unfiltered feed keep the existing Ticketmaster loader and cursor behavior unchanged.

`GET /api/events/[eventId]` recognizes the reserved `kc-market-` prefix and loads that detail locally. Other safe IDs continue to use Ticketmaster. Unknown curated IDs return the same safe 404 contract as unknown Ticketmaster events.

The venue catalogue merges curated venues with Ticketmaster venues, deduplicates by ID, and sorts by name. A Ticketmaster failure must not erase the always-available curated venues, while the event feed continues to report Ticketmaster failures honestly.

The suggestion loader uses curated market names when `category=markets`; it does not spend Ticketmaster quota for that category.

## Domain model

`KiwiCueEventDetail` gains optional curated metadata:

- `source.name`
- `source.url`
- `source.verifiedAt`
- `localizedDescription.zh`
- `localizedNote.zh`

Ticketmaster records omit these fields, preserving their current API behavior. Bookmark parsing accepts valid optional source metadata and remains backward-compatible with existing saved records.

## User experience

### Markets result

- The source strip says `KiwiCue verified schedules` / `KiwiCue 已核实日程` instead of Ticketmaster when Markets is selected.
- The result count says `market schedules`, not `Ticketmaster events`.
- The completion state says all currently verified markets are shown.
- Empty keyword, venue, or date results retain the existing clear-filter action.
- Cards show the next published occurrence, venue, `Market`, and `Schedule verified` status.

### Market detail

- The primary action says `Check official schedule` / `查看官方最新安排`, not `buy tickets`.
- The booking instructions become visit-planning instructions for curated markets.
- The source block shows the organiser, official link, and formatted verification date.
- A notice explains that recurring schedules can change and users should confirm with the organiser before travelling.
- English and Chinese descriptions switch locally without another request.
- Map and distance render only for verified coordinates; the existing unavailable state remains truthful otherwise.

## Failure and freshness behavior

Because curated schedules are bundled with the deployment, the Markets category has no upstream loading failure. Invalid definitions fail tests and cannot be published. The UI does not claim real-time status.

Every definition has a `verifiedAt` date. A test fails when a definition becomes more than 120 days old relative to an explicit audit date, forcing a human recheck before a future release. Runtime pages continue to work if the date ages; freshness enforcement belongs to release verification rather than an end-user outage.

## Security and privacy

- No new secret or environment variable is added.
- Official URLs are fixed HTTPS values, never supplied by users.
- IDs, keyword, venue, size, and date-window inputs continue through existing validators.
- The adapter performs no runtime network request, HTML parsing, location request, or user tracking.
- External links retain `noopener` and `noreferrer`.
- User location remains client-only through the existing distance component.

## Testing strategy

Unit tests cover:

- Next-occurrence calculation before and after opening time.
- Week boundaries and Auckland daylight-saving behavior.
- Date-window, keyword, venue, size, sorting, and stable-ID filtering.
- Safe source metadata and HTTPS official URLs.
- The 120-day verification-age contract.
- Curated detail lookup and unknown-ID behavior.

Route and component tests cover:

- `category=markets` does not invoke Ticketmaster.
- Other categories retain their current loader behavior.
- Curated detail routing and safe 404s.
- Curated venues remain available and deduplicate correctly.
- Market-specific English and Chinese source, count, status, instructions, description, and freshness copy.
- Bookmarks preserve curated metadata.

Playwright covers:

- Markets at 375px and 1440px.
- Keyword and venue filtering.
- Opening one market detail.
- Map/distance or the truthful coordinate-unavailable state.
- Bookmark and Chinese-language behavior.
- No horizontal overflow.

Completion requires fresh successful runs of `npm test`, `npm run lint`, TypeScript validation, `npm run build`, and the existing Playwright suite.

## Git and release boundary

- GitHub issue `#51` tracks the feature and is assigned to the repository owner.
- Work uses `feat/curated-auckland-markets`; no `codex/` prefix is used.
- `skills-lock.json`, local environment files, screenshots, and secrets remain unstaged.
- The feature is committed, pushed, reviewed in a PR, merged, and the issue closed only after verification.
- No deployment, paid service, subscription, or purchase is part of this feature.
