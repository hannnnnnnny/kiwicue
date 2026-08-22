# Cinema Brand Icons Design

Date: 2026-08-23
Status: approved for planning
Issue: #79

## Goal

Make the Auckland cinema directory faster to scan by adding recognizable official cinema brand marks and restrained action icons, without weakening accessibility, mobile layout, privacy, or KiwiCue's non-affiliation boundary.

## Scope

- Add a brand mark to every cinema card.
- Use assets obtained only from the corresponding cinema's official website or official brand resources.
- Store optimized assets locally so opening KiwiCue does not contact cinema domains or disclose visitor data.
- Add consistent session and map icons to the two existing actions.
- Preserve existing cinema names, addresses, search behavior, distance sorting, official URLs, and map URLs.
- Preserve the current Next.js, React, TypeScript, and CSS stack; add no icon or UI dependency.

## Visual design

Each card gains one identity row containing a 48 by 48 pixel brand area and the existing chain/name text. Official marks retain their supplied colors and use `object-fit: contain`; KiwiCue does not recolor them or imitate a cinema's wider visual identity. On narrow screens the brand area becomes 40 by 40 pixels. The logo remains supporting information: the cinema name has the strongest text hierarchy.

The session action receives a small ticket/screen symbol and remains the primary text link. The map action receives a pin symbol. Icons use inline, current-color SVG with a 20 by 20 pixel visual size and are hidden from assistive technology because the adjacent labels provide the accessible name. No emoji, icon font, external icon request, animation, or decorative badge is introduced.

## Asset and trademark boundary

Brand marks are used only to identify the cinema whose official schedule is linked. Assets must come from an official cinema-controlled domain, be recorded in an attribution manifest, and be copied into `public/cinemas/` rather than hotlinked. KiwiCue will retain its existing source/booking disclaimers and must not add wording that suggests partnership, certification, or endorsement.

If an official usable mark cannot be obtained, the card uses a deterministic local fallback containing the cinema or chain initials. A missing or failed image must never render as a broken image. The fallback is part of the initial HTML/CSS rather than dependent on a remote request.

## Component design

- `lib/cinema-directory.ts` adds a bounded local `brandAsset` path and short `brandLabel` to each curated cinema.
- `components/cinema-brand-mark.tsx` owns the image/fallback behavior and accessible naming policy.
- `components/cinema-directory.tsx` composes the identity row and small inline action icons.
- Cinema asset metadata remains curated code, not user input, and paths are restricted to local public assets.
- CSS extends the existing cinema directory rules and uses the established spacing, border, radius, color, and focus tokens.

## Accessibility and responsive behavior

- The brand image uses empty alternative text because the adjacent heading already names the cinema; the fallback is also decorative.
- Session and map links retain explicit accessible names and at least 44 by 44 pixel touch targets.
- The identity row may wrap but never overflow at 375 pixels.
- Brand art cannot push the address or actions outside the card.
- Focus-visible treatment and reduced-motion behavior remain unchanged.

## Failure and loading behavior

All assets are local, so no additional data loading state is introduced. A client-side image error switches that one mark to the initials fallback. Cinema discovery and official links remain usable if every image fails.

## Testing

- Unit tests validate every cinema's local asset path and label.
- Component tests validate official marks, deterministic fallback, accessible names, and safe external-link attributes.
- Existing cinema filtering and distance tests remain unchanged.
- Playwright verifies card layout, touch targets, image-failure fallback, and no horizontal overflow at 375, 768, and desktop widths.
- Run `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e` before merging.

## Out of scope

- Scraping cinema schedules.
- Claiming a commercial partnership.
- Changing ticketing, map, location, search, or session-verification behavior.
- Adding promotional photography, cinema offers, prices, or tracking.
