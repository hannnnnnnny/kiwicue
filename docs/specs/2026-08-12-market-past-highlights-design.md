# Market Past Highlights Design

## Product decision

Recurring Auckland markets should help a first-time visitor understand the experience before opening the organiser site. Event cards use one official link-preview image when a trustworthy image is available. The detail page expands that preview into a short, bilingual "past highlights" guide. The large `AKL` placeholder is removed everywhere.

## Goals

- Make a market card useful within one glance on a 375px phone.
- Show a real atmosphere image without presenting it as KiwiCue-owned media.
- Tell a first-time visitor what they are likely to find, who the market suits, and one practical arrival tip.
- Keep English, Chinese, bookmarks, maps, search, and official schedule links working.
- Fall back to useful text when an image is missing or fails.

## Content model

`KiwiCueEvent` gains an optional `editorialPreview` object:

- `summary`: one concise English sentence for cards.
- `highlights`: two or three English visitor-oriented points for details.
- `image`: optional HTTPS official link-preview image with English alt text, source name, source page URL, and verification date.

`EventLocalization.zh` gains optional localized preview summary, highlights, and image alt text. Content is curated by KiwiCue from facts on the linked organiser page; it is not presented as a direct organiser quotation.

The four organiser series currently backing the 11 schedules receive shared series-level preview data. All Auckland Night Market locations share the Auckland Night Markets preview because the official source describes the overall experience rather than guaranteeing an identical stall mix at every location.

## Image and source rules

- Only an organiser page's explicit `og:image`/link-preview image is eligible in this release.
- The application references the HTTPS image remotely; it does not download or commit third-party image files.
- Every image retains a visible source link on the detail page.
- The UI calls it an official preview image, not a licensed or KiwiCue-owned photograph.
- No Instagram scraping, search-result copying, user-image reuse, or automatic image discovery runs in production.
- If an image URL is missing, non-HTTPS, or fails to load, the UI shows the localized text preview instead.
- The source verification date is stored with the curated record so stale media can be audited with the schedule source.

## Event card

- An event with a working image keeps the current 16:10 cover treatment.
- A curated market whose image is unavailable shows a compact editorial preview panel containing the localized summary and a "What to expect" / "第一次去可以期待" label.
- A non-curated event with neither image nor editorial preview omits the media area completely.
- The chronological rank remains visible but no longer depends on a fake image placeholder.
- The title, date, venue, category, and schedule status remain above the visual preview.
- Image failure swaps to text in place without changing the card action or bookmark state.

## Detail page

- The hero uses the official preview image when available and the same useful text fallback otherwise.
- Curated markets receive a `Past highlights` / `往期精选` section after the visit-planning steps.
- The section contains the localized summary, two or three scannable highlight points, and a visible source link labelled as an official past preview.
- It does not claim that every vendor, product, or stall will appear at the next market.
- Existing description, organiser note, map, distance, bookmark, and official schedule actions remain unchanged.
- Generic Ticketmaster events do not receive the market-only section.

## Responsive and accessibility behavior

- At 375px cards remain single-column, contain no horizontal scrolling, and no empty 16:10 block appears.
- Image alt text describes the market atmosphere on the detail page; list-card images remain decorative because the enclosing link already has the event name and destination.
- Fallback text is real content, not `aria-hidden` decoration.
- Source links have a minimum 44px touch target and an external-destination label.
- Image load transitions use only opacity and respect the existing reduced-motion rules.

## Loading, error, and saved states

- Existing list and detail skeletons remain structurally stable.
- Image errors are local and never turn the entire event card or detail page into an error state.
- Saved curated events preserve validated preview metadata so their useful fallback still works when detail refresh fails.
- Invalid or oversized preview metadata is discarded while a valid base bookmark remains usable.

## Acceptance criteria

- No production card or detail view displays `AKL` as an image replacement.
- All 11 curated market schedules expose bilingual visitor preview copy.
- The four official source series can expose one attributed HTTPS link-preview image each.
- Image failure produces the correct English or Chinese text fallback.
- The detail page shows `Past highlights` / `往期精选` only for curated market records.
- Existing search, filters, details, map, distance, bookmarks, and official links continue to pass.
- Unit, lint, TypeScript, build, and Playwright checks pass at 375px, 768px, and 1440px.
