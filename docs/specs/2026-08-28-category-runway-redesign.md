# Category Runway Redesign

**Date:** 2026-08-28

**Status:** Approved through the user's explicit autonomous-design authorization
**Scope:** Event category navigation and recommendation-card surfaces

## Problem

The current category control is a six-column grid of equal bordered cards. It is clear, but it reads like an administration filter rather than an invitation to discover Auckland. The recommendation grid also uses a black `1px` background gap around cards, creating the visible black frame reported by the user.

Success means:

- categories feel like distinct destinations, not form controls;
- the user can scan, select, and understand all six categories quickly;
- the selected category is unmistakable without relying on a border;
- desktop, tablet, and 375px mobile remain efficient and keyboard accessible;
- recommendation cards have breathing room and no black perimeter or black internal grid;
- URLs, filter preservation, bilingual copy, and recommendation behavior do not change.

## Research set: 30 strong category patterns

This is a deliberately mixed benchmark of consumer discovery products, editorial marketplaces, and open-source/design-system implementations. “Strong” means the pattern offers a useful lesson for KiwiCue, not that every visual detail should be copied.

| # | Product or system | Pattern studied | KiwiCue lesson |
|---:|---|---|---|
| 1 | [Airbnb Categories](https://news.airbnb.com/airbnb-2022-summer-release-highlights/) | Horizontally scannable, icon-led curated collections | Make categories feel like destinations and support lateral discovery. |
| 2 | [Eventbrite discovery](https://www.eventbrite.com/) | Curated category shortcuts paired with temporal scopes | Keep category and time as separate, complementary dimensions. |
| 3 | [Meetup Topics](https://www.meetup.com/topics/) | Human-readable topic families with deep taxonomy | Use concrete intent language rather than internal taxonomy labels. |
| 4 | [Ticketmaster Categories](https://www.ticketmaster.com/categories) | Small set of recognizable top-level event families | Preserve the familiar music/theatre/sport mental model. |
| 5 | [Etsy Gifts](https://www.etsy.com/c/gifts) | Image-led occasion clusters and conversational descriptions | Give each entry a scene and purpose, not only a noun. |
| 6 | [Etsy All Categories](https://www.etsy.com/c) | Direct taxonomy with progressive filters | Keep the first interaction shallow; expose detail after selection. |
| 7 | [Behance Galleries](https://www.behance.net/galleries/graphic-design) | Persistent creative-field rail and curated results | Let the category rail stay visually light while content carries weight. |
| 8 | [Behance Creative Fields](https://help.behance.net/hc/en-us/articles/204483944-Guide-Creative-Fields) | Required taxonomy balanced with flexible discovery | Keep categories broad enough that events have a dependable home. |
| 9 | [GitHub Topics](https://github.com/topics) | Illustrated topic cards with short definitions | A compact visual signature can make abstract labels memorable. |
| 10 | [GitHub Explore](https://github.com/explore) | Editorial collections layered over taxonomy | Pair functional categories with a curated editorial tone. |
| 11 | [Notion Marketplace](https://www.notion.com/en-gb/templates/category) | High-level scopes, visual category cards, item counts | Avoid one giant flat taxonomy; lead with a few confident choices. |
| 12 | [Framer Marketplace](https://www.framer.com/community/marketplace/templates/categories/) | Category families with counts and lightweight nested links | Use hierarchy and rhythm rather than boxing every choice equally. |
| 13 | [Vercel Templates](https://vercel.com/templates) | Compact filters above image-rich content | Category UI should not compete with result imagery. |
| 14 | [Letterboxd Films](https://letterboxd.com/films/) | Facets grouped by user question: year, rating, popularity, genre | Keep independent filter dimensions visibly independent. |
| 15 | [Awwwards Categories](https://www.awwwards.com/websites/art/) | Category, tag, and technology facets with editorial typography | Use typography and whitespace to turn utility into discovery. |
| 16 | [BBC Sounds category tiles](https://downloads.bbc.co.uk/radio/commissioning/WS-InvitationToBid2018-19.pdf) | Image-backed category tiles followed by curated strips | A visual cue plus a short label outperforms dense explanation. |
| 17 | [Steam Categories](https://store.steampowered.com/category/) | Interest-led categories and horizontal content shelves | Let lateral scrolling signal that more discovery is available. |
| 18 | [Dribbble discovery](https://dribbble.com/shots/popular) | Compact topical navigation above a visual feed | Keep navigation fast and let the feed remain the primary surface. |
| 19 | [Pinterest Explore](https://www.pinterest.com/ideas/) | Visual interests arranged as inviting entry points | Categories should promise a mood or outcome, not database structure. |
| 20 | [Spotify Browse](https://open.spotify.com/genre/browse-all) | Artwork-driven genre and mood destinations | Give every category a recognizable visual identity without extra copy. |
| 21 | [Apple segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | Clear single selection with a limited choice count | Six choices are acceptable, but selection must remain obvious at a glance. |
| 22 | [Material chips](https://m3.material.io/components/chips/overview) | Compact filters with explicit selected state | Retain chip-like speed, but avoid their generic visual sameness. |
| 23 | [MUI scrollable tabs](https://github.com/mui/material-ui/blob/master/docs/data/material/components/tabs/tabs.md) | Overflow-aware horizontal navigation and keyboard behavior | Horizontal overflow must be deliberate, discoverable, and touch friendly. |
| 24 | [Carbon tabs](https://carbondesignsystem.com/components/tabs/usage/) | Line tabs versus contained tabs | Avoid contained tab borders when the surrounding page already supplies context. |
| 25 | [Atlassian tabs](https://atlassian.design/components/tabs/) | Understated selection and predictable focus order | Do not reorder choices when one becomes active. |
| 26 | [Adobe Spectrum tabs](https://spectrum.adobe.com/page/tabs/) | Quiet variants, start alignment, overflow behavior | Quiet navigation works when labels and active state remain strong. |
| 27 | [Radix Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) | Complete keyboard model with style left to the product | Preserve native links and document order instead of inventing custom gestures. |
| 28 | [shadcn/ui Tabs](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/tabs.tsx) | Composable unstyled primitives | Keep the component data-driven and styling independent from routing logic. |
| 29 | [Adobe Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/components/tab/) | Concise labels, meaningful icons, explicit selected/focus states | Decorative art must never replace the accessible text label. |
| 30 | [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Formal focus, selection, and relationship semantics | Because categories navigate URLs rather than swap panels, retain semantic links and `aria-current` instead of misusing tab roles. |

## Approaches considered

### A. Refined equal cards

Remove borders, improve typography, and keep the existing six-column grid. This is low risk but remains visually fixed and generic. Rejected because it does not address the user's core criticism.

### B. Minimal chip rail

Use compact rounded chips in a horizontally scrollable row. This is efficient but visually interchangeable with thousands of filter interfaces. Rejected because KiwiCue needs more editorial character and category meaning.

### C. Editorial category runway — selected

Create a horizontal runway of tactile, borderless category posters. The active poster expands, uses the brand green surface, and exposes its description; inactive posters remain compact but contain a custom abstract glyph, label, and directional cue. Desktop shows the runway as an asymmetric composition; narrow screens use native horizontal scrolling and scroll snap. Document order never changes.

This combines Airbnb’s lateral discovery, Etsy’s scenario-led meaning, Behance’s visual rail, and accessibility guidance from Apple, Spectrum, and WAI-ARIA.

## Detailed design

### Category component

- Keep `EventCategoryNav` as a semantic `<section>` containing a labelled `<nav>` of real Next.js links.
- Replace numeric category codes with six lightweight inline SVG glyphs implemented locally; do not add an icon dependency.
- Add a short kicker (`Everything`, `Live sound`, `On stage`, `Local finds`, `Big days`, `Game day`) above each category label in both languages.
- Keep the existing descriptions, but visually reveal them most strongly on the selected item. They remain in the DOM and accessible name for every item.
- Add `data-active` on the `<nav>` and retain each `data-category` attribute for deterministic styling and tests.
- Never reorder links. `All → Concerts → Theatre → Markets → Festivals → Sports` remains the visual, DOM, and keyboard order.

### Visual language

- No 1px card borders.
- Use warm neutral surfaces plus the existing brand green as the only saturated accent.
- Build depth with a restrained green-tinted shadow, large whitespace, and abstract glyph geometry.
- Active category: wider card, green surface, white copy, pale glyph, and visible `Current`/`当前` status.
- Inactive category: quiet raised surface, dark copy, green glyph; hover lifts by 3px and deepens the tinted shadow.
- Use a non-uniform width rhythm so the rail reads as a sequence of editorial posters, not six cells.

### Responsive behavior

- Above 900px: seven implicit columns; the active item spans two columns while all others use one.
- At 900px and below: native horizontal scrolling with `scroll-snap-type: inline mandatory`; every card is at least 168px wide.
- At 600px and below: active card width is approximately 76vw, inactive cards approximately 48vw. Edge padding lets the next card peek into view.
- Scrollbars stay usable; no JavaScript carousel, hidden controls, or gesture-only interaction.

### Recommendation cards

- Remove the black grid technique (`background: var(--portal-ink)`, `gap: 1px`, `padding: 1px`).
- Use transparent grid background, 16–24px gaps, and independent card shells.
- Remove the inherited border from recommendation event cards.
- Integrate the recommendation reason into the same raised surface with a soft tinted header rather than a ruled black strip.
- Preserve the current asymmetric featured card, content, save control, reasons, and ranking semantics.

## Accessibility and motion

- All category links remain at least 44×44 CSS pixels.
- `aria-current="page"` remains the source of truth for selection.
- Focus uses the global 3px focus ring and must not be clipped by the scrolling runway.
- Inline SVG is decorative (`aria-hidden="true"`); visible text supplies the accessible name.
- Hover movement uses `transform`; reduced-motion removes all category and card transforms.
- The runway must not create document-level horizontal overflow at 1440, 768, or 375 pixels.

## Testing and acceptance

- Component tests verify bilingual kickers, stable link order, filter preservation, decorative glyph semantics, and current status.
- CSS contract tests verify no category border, no black recommendation grid, active spanning, scroll snap, and mobile card widths.
- Playwright verifies navigation, current state, 44px targets, focus visibility, horizontal runway scrollability, and zero document overflow at desktop/tablet/mobile.
- Capture full-page screenshots for 1440px, 768px, and 375px and inspect them manually.
- Run `npm test`, `npm run lint`, `npm run test:e2e`, `npm audit --audit-level=high`, `git diff --check`, and an independent final code review before creating the PR.

## Explicit non-goals

- No recommendation algorithm changes.
- No new tracking, personalization backend, account system, dependencies, or image assets.
- No URL or API contract changes.
- No broad redesign of movie, saved, or home pages.
