# Navigation redesign

Approved by the owner on 2026-10-04 after a walkthrough of kiwicue.nz.

## Problems found

1. "← Back to …" links on detail pages push a new entry to `/events`. Filters and scroll are lost, and browser Back returns to the detail page.
2. Every filter tap (quick chips, categories, time window, sort, map) adds a history entry, so leaving the list takes one Back per tap.
3. Returning to the list reloads it from scratch ("Scanning Auckland…"), so the scroll position is lost.
4. `/` and `/events` are the same page. "Picks" (`/recommendations`) and "For You" (`/for-you`) overlap.
5. Three overlapping filter rows: quick chips, time links and categories. "This weekend" appears twice and behaves differently each time.
6. Plans, collections, notifications and account have no clear entry point.
7. The desktop sidebar and the mobile bottom bar list different destinations.

## Design

**Four destinations**, the same in the desktop sidebar and the mobile bottom bar:

- **Discover** (`/`): search, then one filter row, then a List/Map switch.
  - Filters: When (Tonight, This weekend, 7 days, 30 days) · What (categories, including Live music) · Free.
- **Movies** (`/movies`).
- **For You** (`/for-you`): Picks and For You merged; `/recommendations` redirects here.
- **Mine** (`/saved`): tabs for Saved, Plans and Collections.

Account and notifications live behind the avatar. The assistant stays as the floating orb.

**Back rules:**

- Filter changes replace the current history entry; only moving between destinations or pages pushes a new one.
- A detail page's back link calls `history.back()` when the previous entry is a KiwiCue page in this tab. Otherwise it goes to a sensible list.
- Detail pages show a breadcrumb (Discover / category / title).
- The list keeps the results it has loaded for the session, so Back shows the same list at the same scroll position.

## Phases

Each phase ships as its own PR.

1. Back behaviour: replace for filters, real back links, cached results with scroll restored.
2. Destinations: the merged nav, For You merge, Mine tabs, avatar menu, `/events` → `/`.
3. One filter row and the List/Map switch.
