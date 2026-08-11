# Free Movie Discovery and Event Pricing

## Outcome

KiwiCue will add a bilingual Auckland movie-discovery page without purchasing data or scraping cinema websites without permission. The same release will expose Ticketmaster's real event price ranges across event cards, event details, and saved events.

The movie page must remain useful when no open screening feed covers Auckland. In that case it becomes a fast, searchable directory of Auckland cinemas with location, distance, and direct links to each cinema's official session page. If the free Open Cinema Platform later returns Auckland screenings, the same page will show them automatically.

## Product boundaries

### Included

- A top-level `/movies` route linked from global navigation.
- English and Chinese copy that follows the existing language preference.
- Search by film, cinema, or suburb.
- Date choices for today, tomorrow, this weekend, and all available dates.
- A curated Auckland cinema directory containing factual location data and official HTTPS links.
- Opt-in browser geolocation, local distance calculation, and distance sorting.
- Free Open Cinema Platform screening ingestion through a server-only adapter.
- Loading, empty, partial-data, unavailable-source, and image-failure states.
- Official booking/session links opened safely in a new tab.
- Ticketmaster price range normalization, formatting, display, and saved-event compatibility.
- Tests and responsive checks at 375px, 768px, and 1440px.

### Excluded

- Paid movie or showtime APIs.
- Scraping Flicks, EVENT, HOYTS, Reading, or other websites without written permission.
- Seat selection, payment, ticket resale, affiliate tracking, user accounts, or a public submission form.
- Invented prices, estimated prices, or stale manually entered screening times.
- TMDB production use until KiwiCue has an appropriate commercial licence.
- Nationwide cinema coverage in the first release; Auckland remains the pilot.

## Approaches considered

### 1. Paid aggregator

movieXchange or MovieGlu could provide broad showtime coverage, but pricing and New Zealand permissions require commercial discussions. This violates the zero-cost constraint.

### 2. Direct scraping

Scraping major cinema and Flicks pages could produce broad coverage temporarily, but it is operationally fragile and may breach published terms. This approach is rejected.

### 3. Open feed plus official-directory fallback

The selected approach uses the free Open Cinema Platform where data exists and a maintained directory of official cinema links everywhere else. It provides immediate user value, has a clean upgrade path, and never presents fabricated showtimes.

## Information architecture

The global header will expose three primary destinations: Events, Movies, and Saved. The movie page will use this order:

1. Compact title and source explanation.
2. One search field for film, cinema, or suburb.
3. Large date controls.
4. A clear source/status strip.
5. Live open screenings when available.
6. An Auckland cinema directory and official-session links.
7. A short accuracy and privacy note.

The movie experience will not imitate the event dashboard. It will reuse KiwiCue's editorial typography, color tokens, control sizes, spacing, and responsive grid.

## Movie data architecture

### Open screening provider

`lib/open-cinema.ts` will own all upstream types, validation, normalization, URL construction, timeouts, and error mapping. It will request screenings around Auckland from the Open Cinema Platform public v1 endpoint. An optional `OPEN_CINEMA_API_KEY` may be supplied server-side if the provider requires it; the client never receives the key.

The public `/api/movies` route will accept only bounded, validated `q` and `date` values. It will query the normalized provider and return a stable KiwiCue response. Upstream failures return a controlled partial-data response so the cinema directory remains usable.

Provider responses are untrusted input. Film titles, cinema names, URLs, dates, coordinates, formats, poster URLs, and purchase URLs will be length-bounded and validated. Only HTTPS external links are accepted. Unknown fields are ignored.

### Cinema directory

`lib/cinema-directory.ts` will contain a small Auckland directory using factual data from official cinema pages: id, name, chain, suburb, address, coordinates, and official sessions URL. No session times or prices are stored.

The directory is filtered locally by cinema, chain, and suburb. Distances are calculated only after the user explicitly grants location access. Location is not stored or sent to KiwiCue analytics.

### UI states

- Loading: screening-shaped skeletons, not a spinner.
- Open screenings available: cards ordered by time, with film, cinema, time, format, distance when enabled, and official booking link.
- No Auckland screenings in the open feed: an honest message followed immediately by the useful cinema directory.
- Provider unavailable: a non-blocking warning; directory remains available.
- Search with no result: clear reset action and directory remains reachable.
- Broken image: deterministic KiwiCue fallback.

## Event price architecture

Ticketmaster Discovery API `priceRanges` will normalize to a nullable `KiwiCuePriceRange` containing ISO currency, minimum, and maximum. Invalid, negative, non-finite, reversed, or unsupported ranges are discarded.

Display rules:

- Same minimum and maximum: `NZ$49`.
- Range: `NZ$49–129`.
- Decimal values are preserved only when needed.
- Missing range: `Price on official site` / `价格以官网为准`.
- The UI never describes the API range as inclusive of fees.

Price appears after date and venue on event cards, near the booking action on event details, and on saved event cards. Existing local bookmarks that do not contain a price remain valid and gain `priceRange: null` during parsing.

## Accessibility and responsive behavior

- Every control has a visible label and a minimum 44×44px target.
- Search, date controls, source warnings, and empty states have semantic roles and localized accessible names.
- Keyboard order follows the visible order.
- External links use `noopener` and explain that they open official sites.
- No horizontal overflow at 375px.
- The cinema grid uses one column at 375px, two at 768px, and up to three at 1440px.
- Geolocation is requested only after a clear user action.
- Reduced-motion preferences disable nonessential transitions.

## Testing strategy

Unit and component tests will cover:

- Open Cinema query validation and response normalization.
- Rejection of unsafe URLs, invalid coordinates, malformed dates, and oversized text.
- Movie API success, empty, and upstream-failure behavior.
- Cinema directory filtering and distance ordering.
- Bilingual navigation and movie-page copy.
- Movie loading, empty, error, and populated states.
- Ticketmaster price normalization and formatting.
- Backward-compatible bookmark parsing.
- Price presentation on event card, detail, and saved views.

Playwright will verify the movie journey, official link safety, location opt-in, English/Chinese switching, keyboard focus, and overflow at the three target widths. Existing event and saved journeys must remain green.

## Release workflow

- Create separate GitHub issues for movie discovery and event pricing, assigned to `hannnnnnnny`.
- Implement on `feat/free-movie-discovery`.
- Do not commit `skills-lock.json`, local environment files, credentials, screenshots containing secrets, or internal process artifacts.
- Run unit tests, lint, build, type checking, and Playwright.
- Commit with a product-focused message, open a ready PR that closes both issues, merge only after checks pass, and confirm the issues are closed.
