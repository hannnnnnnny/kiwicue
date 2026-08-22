# KiwiCue movie data and privacy audit

Date: 2026-08-23
Scope: movie discovery, Auckland session verification, API credentials, location, bookmarks, and browser security headers.

## Trust boundary

KiwiCue has two deliberately separate movie sources:

- TMDB supplies movie metadata, posters, synopses, ratings, release dates, and trailers. These records are previews and are never proof of a current Auckland screening.
- Open Cinema Project is the only machine-readable live-session source currently authorized for use. A movie receives a verified label only after an exact normalized title match against a validated, future Auckland screening.
- Official cinema-directory URLs are navigation fallbacks. They are not ingested or represented as live data.

On 2026-08-23 the authenticated Open Cinema theater endpoint returned `count: 0` within 100 km of central Auckland. KiwiCue therefore reports `not-covered`, does not claim that Auckland has zero movie sessions, and does not mark any TMDB preview as verified.

## Findings and controls

### SEC-01 — Ambiguous empty live feed (resolved, high)

- Evidence: `lib/open-cinema.ts` validates the authorized `/theaters` response; `app/api/movies/route.ts` fails closed before requesting or displaying screenings when coverage is absent.
- Previous impact: an empty upstream response could be read as “no Auckland films are showing” even when the provider simply had no Auckland coverage.
- Resolution: the API now distinguishes `covered`, `not-covered`, and `unavailable`, includes a server-generated `checkedAt` timestamp, and the bilingual UI explains the difference.
- Verification: `tests/open-cinema.test.ts`, `tests/movies-route.test.ts`, `tests/movie-screening-feed.test.tsx`, and `tests/movies-page-content.test.tsx`.

### SEC-02 — Upstream quota amplification and query disclosure (resolved, high)

- Evidence: `app/api/movies/route.ts` validates the public query, requests a fixed date-bucket catalog with `query: null`, and filters locally. `app/api/movie-previews/[movieId]/route.ts` also verifies against the fixed all-sessions catalog.
- Previous impact: arbitrary public search terms could create distinct third-party requests, disclose user-entered titles to the provider, and consume API quota.
- Resolution: user queries are never forwarded to Open Cinema. Fixed upstream URLs use five-minute screening caching; coverage uses one-hour caching, following the provider's fair-use guidance.
- Verification: `tests/movies-route.test.ts`, `tests/movie-preview-detail-route.test.ts`, and `tests/open-cinema.test.ts`.

### SEC-03 — Untrusted checkout destinations (resolved, high)

- Evidence: `lib/open-cinema.ts` accepts only HTTPS checkout links whose hostname is an exact or subdomain match for a known Auckland cinema or Veezi. An unknown HTTPS host is suppressed while the schedule remains visible.
- Impact prevented: a compromised or malformed upstream record cannot turn KiwiCue into a phishing redirect.
- Verification: `tests/open-cinema.test.ts` covers unsafe schemes, malformed records, and lookalike hosts.

### SEC-04 — API credential exposure (verified, no finding)

- Evidence: `OPEN_CINEMA_API_KEY`, `TMDB_READ_ACCESS_TOKEN`, and `TICKETMASTER_API_KEY` are read only in server modules and route handlers. `.env.local` is ignored; `.env.example` contains names only.
- Control: credentials are sent in authorization headers, never URLs or browser payloads. Error envelopes do not include upstream bodies, stack traces, or credentials.

### SEC-05 — Location privacy (verified, no finding)

- Evidence: `components/movies-page-content.tsx` and `components/distance-panel.tsx` request geolocation only after a user action, validate coordinate ranges, and calculate distance in the browser.
- Control: coordinates are held in React memory only. They are not sent to KiwiCue, third-party APIs, local storage, logs, or analytics.

### SEC-06 — Local bookmarks (verified, low residual risk)

- Evidence: `lib/bookmarks.ts` caps serialized input size, candidate count, and saved count; validates every nested field, date, coordinate, ID, and HTTPS URL; rejects malformed JSON.
- Control: bookmarks contain public event data only and remain in browser local storage. KiwiCue stores no account, payment, identity, or contact data.
- Residual risk: browser-local data can be read by any successful same-origin script injection. The CSP and input validation reduce this risk; bookmarks must never be expanded to include sensitive user data.

### SEC-07 — Missing browser hardening headers (resolved, medium)

- Evidence: `next.config.ts` applies CSP, clickjacking protection, MIME-sniffing prevention, referrer policy, HSTS, and a restrictive permissions policy to every route.
- Control: framing is denied; objects are disabled; camera, microphone, payment, and USB are disabled; geolocation is limited to self; trailers and maps are limited to YouTube's privacy-enhanced host and OpenStreetMap.
- Verification: `tests/security-headers.test.ts` plus deployed response-header inspection.

## Public API authentication decision

`GET /api/movies` and movie-preview routes are intentionally public and read-only because the website must work without accounts. They expose only already-public event/movie data and do not accept mutations. This is the documented exception to the default-authentication rule. Abuse controls are bounded input, duplicate-parameter rejection, fixed upstream query shapes, upstream caching, provider rate limits, defensive parsing, and safe error responses.

## Residual risks and operating rules

1. Open Cinema currently has no Auckland coverage. This requires provider participation or a written license from another source; code cannot lawfully create verified schedules from unavailable data.
2. Official cinema-directory URLs are curated and can change. Review them periodically and remove dead links; do not scrape protected cinema pages without written permission.
3. The CSP allows inline scripts/styles for current Next.js rendering compatibility. A nonce-based CSP would be stronger but requires a separate rendering architecture change and regression pass.
4. Do not add analytics, server-side location storage, accounts, payments, or user-generated content without a new privacy and threat-model review.
5. Rotate any credential immediately if it appears in a screenshot, Git history, client bundle, log, issue, or support message.

## Dependency check

`npm audit --omit=dev` reported zero known vulnerabilities during this audit. This is a point-in-time signal, not a guarantee; dependency scanning should be repeated before releases.
