# KiwiCue Primal-inspired editorial UI redesign

**Date:** 2026-08-14

**Status:** Approved direction; pending written-spec review

**Reference:** Primal Pastures, adapted for an Auckland event-discovery product rather than copied as an ecommerce layout

## 1. Objective

Redesign KiwiCue as a warm, image-led Auckland culture guide while preserving its primary job: a visitor should be able to search or begin browsing a useful event within ten seconds.

The redesign covers the homepage, event discovery, event details, movies, movie details, and saved events. Existing API behavior, URL structure, filtering, bilingual display, maps, distance calculation, bookmarks, Ticketmaster integration, curated markets, and TMDB integration remain unchanged.

## 2. Design read

### Reference qualities to retain

- Large, confident photography paired with restrained typography.
- Editorial serif display type combined with a practical sans-serif interface type.
- Warm paper surfaces, charcoal text, strong image contrast, and minimal decorative color.
- Broad horizontal compositions, controlled asymmetry, and occasional text overlapping image boundaries.
- Thin navigation and dividers instead of repeatedly boxed controls.
- Clear primary actions without a generic SaaS-dashboard appearance.

### Current KiwiCue weaknesses

- The repeated four-column card grid makes unrelated events look visually identical.
- Most surfaces use the same border, radius, and shadow treatment, so hierarchy is weak.
- Event imagery is useful but appears after dense metadata and does not drive discovery.
- The homepage and listing page feel like separate visual systems.
- Search is functionally prominent but visually resembles a form panel rather than a fast discovery command.
- Movie, event, saved, and detail views share tokens but not a recognizable editorial rhythm.
- Mobile is usable, but stacked cards become long and repetitive rather than quick to scan.

## 3. Chosen approach

Use an **Auckland editorial culture guide** adaptation of the reference.

This is not a pixel copy. Primal Pastures uses a sales hero and product cards; KiwiCue will use the same visual confidence for real event photography, dates, venues, and search. Search efficiency always takes precedence over decorative composition.

## 4. Visual system

### Palette

All colors remain centralized as CSS custom properties.

- `paper`: warm bone background, approximately `#F2EDE3`.
- `surface`: soft ivory, approximately `#FBF8F1`.
- `ink`: warm charcoal, approximately `#24231F`.
- `muted`: olive-gray, approximately `#6C7066`.
- `line`: low-contrast warm gray, approximately `#D5D0C5`.
- `brand`: deep olive, approximately `#344B3B`.
- `brand-dark`: near-black forest, approximately `#24342A`.
- `accent`: restrained clay, approximately `#A64F3D`, used only for urgent date/status emphasis.
- Existing danger and focus colors remain semantically distinct and WCAG AA compliant.

No gradients, glass effects, neon accents, or high-saturation green are introduced.

### Typography

- Keep Manrope Variable for controls, metadata, body copy, Chinese text, and dense scanning.
- Add a dependency-free editorial serif stack (`Iowan Old Style`, `Baskerville`, `Times New Roman`, serif) for large English display headings and selected event titles.
- Chinese headings fall back to the existing CJK sans-serif stack to avoid awkward mixed-script serif rendering.
- Use balanced wrapping, tighter display tracking, and tabular figures for dates and result counts.
- Important labels use sentence case; small uppercase text is reserved for compact metadata only.

### Shape and depth

- Controls remain 8px.
- Content panels and standard event cards remain 12px.
- Pills are restricted to active filters, categories, status, and counts.
- Featured-image masks may use one deliberate large curved edge inspired by the reference hero; this is a composition device, not a new general radius token.
- Shadows are reduced. Photography, spacing, surface contrast, and thin dividers carry most hierarchy.

### Motion

- 180–220ms transitions using only `transform` and `opacity`.
- Images can scale up to roughly 1.015 on hover.
- Cards may lift by at most 2px.
- No looping motion, parallax, smooth-scroll libraries, or new animation dependency.
- `prefers-reduced-motion` disables non-essential transitions.

## 5. Page design

### Global header

- Use a slim, nearly borderless editorial header.
- Retain KiwiCue, Events, Movies, Saved, and language controls.
- Present desktop navigation as quiet text links with an underline or weight change for the active page.
- Keep saved count as a compact semantic badge.
- At 375px, retain large touch targets and collapse only non-essential brand copy; navigation must not overflow horizontally.

### Homepage

- Replace the current split dashboard-like hero with an image-led Auckland opening composition.
- The left copy states the product promise in one short display headline.
- The right or background visual uses a real event image already supplied by event data, with a useful fallback when unavailable.
- Place a compact search entry and the primary “Browse Auckland events” action in the first viewport.
- Follow with four categories as an editorial index, not four boxed cards.
- Surface a small set of current event signals so the homepage is useful, not only promotional.
- Retain bilingual copy and provide image-failure, loading, and empty states.

### Events page

- Keep search immediately beneath a shorter heading.
- Restyle search as a horizontal command bar on desktop and a clean vertical group on mobile.
- Preserve keyword suggestions, venue selection, category, and date filtering.
- Replace the uniform grid with an editorial result layout:
  - the first useful result is a wide featured story;
  - the following results use a balanced two- or three-column grid depending on width;
  - images receive more space, but event name, date, and venue remain visible before secondary metadata;
  - subsequent “load more” groups use the same deterministic pattern to avoid layout movement.
- Market editorial fallbacks remain informative and no longer display large meaningless location initials.
- Search and filters remain fully keyboard accessible and preserve URL-driven state.

### Event cards

- Make the entire informational region the primary detail link while keeping bookmark as a separate valid control.
- Order information as name, date/time, venue, category/status, visual, detail cue.
- Use high-quality event imagery at consistent crops; preserve existing image failure handling.
- Use a restrained date block or typographic date line rather than multiple badge rows.
- Keep long Chinese and English titles readable without hiding key information.

### Event details

- Lead with a large editorial title and useful facts, paired with a dominant event image.
- Keep booking/official-source action visible in the first screen.
- Arrange description, market past highlights, and booking guidance as continuous editorial sections separated by whitespace and rules.
- Retain a desktop venue sidebar, but reduce its card-within-card appearance.
- On mobile, use one column and position the official action where it remains easy to reach.
- Preserve map unavailable, distance unavailable, event missing, API error, and image failure states.

### Movies

- Treat posters as the strongest visual asset and adopt a cinema-program editorial layout.
- Keep search, date filtering, previews, synopses, trailers, sessions, cinema directory, and TMDB attribution.
- Use a wider featured movie followed by compact poster-led cards.
- On 375px, use a single prominent featured item and a safe two-column poster grid only where text remains legible; otherwise fall back to one column.
- Movie detail uses an asymmetric poster-and-copy composition that becomes a single column on mobile.

### Saved events

- Reuse event-card styles and editorial spacing.
- Keep local storage and refresh behavior unchanged.
- Empty state explains how to save an event and provides one clear route back to discovery.
- Clear-all remains a two-step destructive action.

## 6. Component and CSS boundaries

No framework or styling migration is planned.

- `app/styles/tokens.css`: palette, typography, spacing, radii, elevation, motion, and z-index tokens.
- `app/styles/base.css`: global typography, focus, reduced motion, and shared primitives.
- `app/styles/shell.css`: header, homepage shell, search, filters, footer.
- `app/styles/events.css`: editorial result grid and event-card variants.
- `app/styles/detail-saved.css`: detail, venue, map, and saved flows.
- `app/styles/movies.css`: movie discovery and detail compositions.
- `app/styles/responsive.css`: explicit 375px, 768px, and desktop adaptations.
- React components receive only the small semantic/class-name adjustments needed by the layout; data fetching and business rules are not redesigned.

Repeated visual structures should become shared classes or small focused presentational components. No new UI library is required.

## 7. Data flow and behavior

The redesign does not change data ownership:

1. Server routes continue to normalize Ticketmaster, curated market, and TMDB data.
2. Existing client components continue to own search form state, language state, bookmark state, and retry behavior.
3. URL query parameters remain the source of truth for event and movie filters.
4. Visual variants derive only from stable result position or existing event metadata; they do not alter sorting or filtering.
5. All external actions continue to open validated official URLs with existing safe-link behavior.

## 8. State completeness

Every redesigned surface must provide a visually matched state for:

- loading skeletons that resemble the final layout;
- empty discovery results;
- keyword search with no matches;
- API unavailable and retry;
- saved list empty;
- map/distance unavailable;
- missing event or movie;
- image/poster loading failure;
- disabled and submitting controls.

States must remain bilingual and must not rely on color alone.

## 9. Accessibility and responsive requirements

- WCAG 2.2 AA contrast for text, controls, selected filters, errors, and focus rings.
- Real labels and descriptions for search fields.
- Visible `:focus-visible` on every interactive element.
- Minimum 44×44px primary touch targets.
- Correct heading order and semantic landmark structure.
- No horizontal overflow at 375px.
- Verify at 375px, 768px, and 1440px in both English and Chinese.
- Preserve reduced-motion support and avoid layout-shifting image containers.

## 10. Verification

Run and record:

- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:e2e`

Use a real browser to cover:

- homepage;
- event list with default, filtered, loading, empty, and error states;
- an event detail with image, map, distance, bookmark, and official link;
- curated market preview and past highlights;
- movie list and movie detail with poster, synopsis, trailer, and unavailable state;
- saved empty and populated states;
- English and Chinese at 375px, 768px, and 1440px.

Capture desktop and mobile screenshots for the homepage, event list, event detail, movie list, and saved empty state.

## 11. Acceptance criteria

- A first-time visitor can search or begin browsing a real event within ten seconds.
- The site clearly resembles an Auckland editorial culture guide rather than an ecommerce store or SaaS dashboard.
- Photography and typography create visual interest without hiding event date, venue, or search.
- Existing APIs, routes, filters, bookmarks, maps, movies, and bilingual behavior continue to work.
- All core states are complete and bilingual.
- No horizontal overflow appears at 375px.
- No secrets, hardcoded API keys, unrelated refactors, or unnecessary dependencies are introduced.
