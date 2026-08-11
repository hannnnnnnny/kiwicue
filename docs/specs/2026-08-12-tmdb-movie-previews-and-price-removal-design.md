# TMDB Movie Previews and Complete Price Removal

## Outcome

KiwiCue will turn `/movies` into a useful non-commercial New Zealand movie-discovery experience. Users can scan current films by poster, title, synopsis, release information, and rating, then open a KiwiCue detail page to watch an official trailer before following an Auckland cinema's official sessions page.

The same release removes every event-price label, range, fallback, and price-specific domain field. KiwiCue will no longer imply that an unavailable price is useful information.

## Confirmed product boundaries

### Included

- Free TMDB API integration for a non-commercial KiwiCue deployment.
- New Zealand (`NZ`) now-playing discovery.
- English and Chinese movie metadata following KiwiCue's language setting.
- Search by movie title.
- Poster-led movie cards with title, release date, rating, short synopsis, and a clear in-site preview action.
- A stable in-site detail route at `/movies/[movieId]`.
- Official trailer playback through YouTube's privacy-enhanced embed domain when TMDB supplies a valid trailer.
- Honest no-trailer, no-poster, loading, empty, and upstream-unavailable states.
- The existing Auckland cinema directory, distance sorting, and official session links.
- TMDB attribution and the required non-endorsement notice.
- Complete removal of prices from event cards, details, saved events, domain types, normalization, styles, and tests.
- Responsive and keyboard-accessible behavior at 375px, 768px, and 1440px.

### Excluded

- Paid movie APIs, paid licences, or paid infrastructure.
- Scraping cinema, review, or ticketing websites.
- Claiming that TMDB metadata represents live Auckland cinema schedules.
- Seat selection, checkout, payment, or ticket resale.
- User reviews, public comments, ratings submission, or accounts.
- Autoplaying trailers.
- Invented trailers, poster URLs, descriptions, prices, or session times.
- Monetizing the TMDB-backed experience without first revisiting TMDB's commercial-use terms.

## Source responsibilities

The UI must make each source's job clear:

- **TMDB** supplies movie identity, localized title, overview, poster, release data, rating, and video metadata.
- **Open Cinema** remains the optional source for open screening records where available.
- **Official cinema websites** remain the authoritative source for current Auckland sessions, ticket types, availability, and booking.
- **Ticketmaster** continues to supply Auckland events, but price information is deliberately ignored.

TMDB must not be described as a live cinema timetable. When the open screening feed is empty, the page still offers useful film discovery and direct official cinema links.

## User experience

### `/movies` hierarchy

The page will use this order:

1. Compact movie finder title and one plain-language source explanation.
2. Search field and date controls already used for screening discovery.
3. A `Now playing in New Zealand` / `新西兰近期电影` preview section.
4. Optional live Auckland screening results when the open feed provides them.
5. Auckland cinema directory, distance control, and official-session links.
6. TMDB attribution, source accuracy note, and non-commercial notice.

The movie preview grid must appear before the large cinema directory so users can answer “what should I watch?” before choosing where to watch it.

### Movie cards

Each card contains one content surface and follows this scan order:

1. Poster or a quiet branded fallback.
2. Movie title.
3. New Zealand release date when available.
4. TMDB audience rating only when a valid vote average exists; it is labelled as a TMDB rating, not a critic score.
5. A two-to-three-line synopsis on the listing page.
6. `Preview` / `查看预览` as the single primary action.

The full card title and poster link to `/movies/[movieId]`. Long Chinese and English titles wrap without hiding meaningful words. Cards never show prices.

### Movie detail and trailer

`/movies/[movieId]` is an in-site page, not a modal, so it is shareable, works with browser history, and remains usable on mobile.

The first screen contains:

- Back to movies.
- Poster.
- Localized title and original title when different.
- Release date, runtime, certification when available, genres, and TMDB rating.
- Full localized synopsis.
- Trailer area.

Trailer selection order:

1. Official YouTube video with type `Trailer` in the selected language.
2. Official YouTube trailer in English.
3. Any valid YouTube trailer supplied by TMDB.
4. Localized `No official trailer is currently available` state.

The embed uses `https://www.youtube-nocookie.com/embed/{key}`, `loading="lazy"`, a localized title, `allowFullScreen`, and no autoplay. Video keys are accepted only when they match a strict YouTube-ID allowlist pattern. No arbitrary embed URL from an upstream response is rendered.

Below the preview, users see the existing Auckland cinema directory and can open each cinema's official session page. The page must not claim a specific cinema is showing the film unless KiwiCue has a verified screening record for that movie.

## TMDB data architecture

### Credentials

The server-only environment variable is:

```text
TMDB_READ_ACCESS_TOKEN
```

It contains TMDB's Read Access Token. It is never prefixed with `NEXT_PUBLIC_`, serialized into page props, logged, committed, or included in an error response. `.env.example` documents the variable with an empty value only.

### Server adapter

`lib/tmdb.ts` owns:

- TMDB request construction.
- Bearer authentication.
- Eight-second request timeout.
- Bounded pagination.
- Response validation and normalization.
- Image URL construction using TMDB's known image host and supported sizes.
- Localized request language.
- Trailer selection.
- Stable, non-sensitive error mapping.

The adapter returns KiwiCue-owned models from `lib/movie-previews.ts`; React components never consume raw TMDB payloads.

List requests use TMDB's current `now playing` endpoint with `region=NZ`. English uses `en-NZ` where supported, with `en-US` fallback behavior handled by TMDB; Chinese uses `zh-CN`. Search requests use TMDB movie search with the same region and bounded query.

Detail requests retrieve movie detail plus videos and release-date information. Only fields required by the UI are retained.

### Public application API

The existing `/api/movies` screening contract remains unchanged. TMDB receives separate routes:

- `GET /api/movie-previews?language=en|zh&q={query}&page={page}`
- `GET /api/movie-previews/[movieId]?language=en|zh`

Validation rules:

- `language` is exactly `en` or `zh`.
- `q` is NFC-normalized, whitespace-collapsed, and limited to 100 characters.
- `page` is an integer from 1 to 20.
- `movieId` is a positive base-10 integer within JavaScript's safe integer range.
- Unknown parameters are ignored.

Responses expose only normalized KiwiCue fields. Configuration errors and upstream failures return controlled codes and localized UI states; they never return tokens or raw upstream bodies.

Successful list and detail reads use Next server caching with a bounded revalidation window. Cache keys contain only normalized language, query, page, or movie ID, preventing arbitrary high-cardinality inputs from exhausting the upstream quota.

### Models

The list model contains:

- `id`
- localized `title`
- `originalTitle`
- `overview`
- `posterUrl`
- `releaseDate`
- `rating`
- `ratingCount`

The detail model adds:

- `runtimeMinutes`
- normalized `genres`
- New Zealand certification when available
- selected `trailerKey`
- `tmdbUrl`

All strings are length-bounded. Invalid dates, ratings outside 0–10, impossible runtime values, unsafe URLs, malformed video keys, and incomplete records are discarded or converted to `null`.

## Attribution and licence boundary

The movie page and detail page include a readable attribution area containing the approved TMDB logo asset and this notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

The Chinese page provides a Chinese explanation while retaining the required English notice. Attribution links to TMDB. The asset is stored locally only if TMDB's branding rules permit it; otherwise it is rendered from the approved official asset URL.

Because this design relies on TMDB's free non-commercial terms, any future advertising, affiliate revenue, paid membership, sale, or commercial sponsorship triggers a licensing review before launch.

## Complete event-price removal

Price removal is a domain cleanup, not merely a CSS hide:

- Remove `KiwiCuePriceRange` and `priceRange` from event types.
- Stop reading `priceRanges` from Ticketmaster responses.
- Delete `lib/event-price.ts`.
- Remove price rendering and price-specific classes from event cards and event details.
- Saved-event parsing ignores legacy `priceRange` keys rather than rejecting old bookmarks.
- Remove price fixtures, assertions, and the dedicated price tests.
- Confirm no English or Chinese price fallback remains in production output.

Existing saved events continue to load because unknown JSON keys are ignored and all required non-price fields remain unchanged.

## State completeness

### Movie preview list

- **Loading:** poster-card skeletons matching final card geometry.
- **Ready:** responsive movie grid.
- **Search empty:** query-specific explanation and reset action.
- **Now-playing empty:** honest source message; live screenings and cinema directory remain available.
- **API unavailable:** non-blocking warning with retry; cinema directory remains usable.
- **Missing poster:** branded aspect-ratio fallback containing the title, not a broken image.
- **Poster failure:** image error swaps to the same fallback without changing layout.

### Detail

- **Loading:** poster, metadata, synopsis, and trailer-shaped skeletons.
- **Not found:** localized explanation and return-to-movies action.
- **API unavailable:** localized retry and cinema-directory fallback.
- **No overview:** source-aware fallback, never generated copy.
- **No trailer:** quiet explanatory panel; no broken iframe.
- **Trailer load failure:** retain title and offer a safe direct YouTube link derived from the validated video ID.

## Accessibility, privacy, and responsive behavior

- All interactive targets are at least 44×44px.
- Cards use real links; no clickable `div` elements.
- Search has a visible label and inline validation help.
- Skeleton containers expose one polite loading announcement and hide decorative blocks from assistive technology.
- The trailer iframe has a localized title and is inserted only after the user opens a detail page.
- YouTube privacy-enhanced mode is used and no autoplay occurs.
- Focus order follows visual order; `:focus-visible` remains clear.
- 375px uses one column, 768px uses two, and 1440px uses four movie cards where space allows.
- The detail page is one column on small screens and poster/content columns on desktop.
- Posters retain a stable aspect ratio, preventing layout shift.
- No horizontal overflow at the three target widths.
- Reduced-motion preferences disable nonessential transitions.

## Testing strategy

Unit tests cover:

- TMDB URL construction without exposing the token in logs or responses.
- List, search, detail, video, image, certification, and bilingual normalization.
- Rejection of malformed IDs, video keys, dates, ratings, URLs, and oversized text.
- Timeout, authentication, not-found, quota, malformed-payload, and generic upstream errors.
- Trailer language and official-video preference order.
- Removal of Ticketmaster price normalization.
- Backward-compatible parsing of bookmarks containing legacy price keys.

Component and route tests cover:

- Movie preview loading, ready, empty, error, missing-poster, and no-trailer states.
- English and Chinese content.
- In-site navigation from movie card to detail.
- Trailer iframe safety attributes.
- TMDB attribution on list and detail pages.
- No price text or price element on event cards, details, or saved events.

Playwright covers:

- `/movies` at 375px, 768px, and 1440px.
- Movie search and reset.
- Opening an in-site detail page.
- Trailer or no-trailer state.
- Cinema official-link safety.
- English/Chinese switching.
- Event, detail, and saved journeys with no price output.
- Keyboard focus and horizontal-overflow checks.

The implementation is complete only after `npm test`, `npm run lint`, TypeScript validation, `npm run build`, and the existing Playwright suite pass.

## Git and deployment boundary

- Work continues on `feat/movie-previews`; no `codex/` branch prefix is used.
- `skills-lock.json`, local environment files, tokens, generated secrets, and screenshots containing secrets are never staged.
- The implementation will produce a clear commit and PR only after verification.
- The TMDB environment variable must be configured separately in Vercel before the production feature can load live data.
- No paid service is enabled and no purchase is made.
