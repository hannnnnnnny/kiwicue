# Cinema brand final fixes

## Scope completed

- Replaced the duplicated generic icon with the official EVENT `ec-logo.svg` and the official Rialto `rialto-logo_white-on-trans-horiz.png`.
- Kept both assets local under `public/cinemas`; the client has no brand-asset hotlinks.
- Recorded the exact official resource URLs and 2026-08-23 retrieval date in `public/cinemas/SOURCES.md`.
- Mapped EVENT cinemas to `/cinemas/event.svg`, Rialto to `/cinemas/rialto.png`, and kept Reading mapped to its official white SVG.
- Added a tokenized dark backing for Reading's white wordmark (`var(--portal-ink)`), without changing the official image. EVENT and Rialto's official white marks use the same treatment.
- Updated both directory action SVGs to 20 by 20 pixels.

## Asset validation

| Asset | Bytes | SHA-256 | Validation |
| --- | ---: | --- | --- |
| `event.svg` | 1,041 | `7B9017AC95987FE7AAF3878455EC6A5C0CECE7AC6FB9D8EBE03FC853F4B861A2` | XML/SVG safety parser: no script, event handlers, or external resource references |
| `rialto.png` | 3,620 | `CAA6F4C9CC5EC52446BD077D0D8DD06EF63E8B61913EB762F4CA4D0DFC10CDA7` | PNG signature, chunk length, CRC, and terminal chunk parser |

## Regression coverage

- Asset test verifies the exact source manifest, safe local formats, and that EVENT and Rialto are byte-distinct.
- Directory test verifies the semantic EVENT, Reading, and Rialto mappings.
- Component test verifies Reading's dark backing and both action icons' 20 by 20 dimensions.
- Browser test exercised the movie directory on desktop, tablet, and 375px mobile without overflow.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm test` — 54 files, 514 tests passed; plus 4 static-site checks passed.
- `npm run test:e2e -- --grep "movie search, dates, distance, language, maps, and official links work"` — 3 projects passed.
