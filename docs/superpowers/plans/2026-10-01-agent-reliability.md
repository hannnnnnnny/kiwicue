# KiwiCue reliable outing assistant

User authorizes implementation, at least 200 substantive commits, PR creation and merge.

## Design

Preserve the existing UI and five assistant personas. Keep dates, times, places, free-only
and budget constraints strict. Distinguish a total party budget from a ticket ceiling.
Unknown prices remain visible with explicit uncertainty; lowest advertised prices never
prove a family outing is within budget. Search results carry trusted official booking URLs.
Retain conversations in the current browser tab across closing and navigation, with bounded
validated storage. New chat clears prior context. Save a selected shortlist as an editable
local outing plan and export calendar entries without inventing end times or travel estimates.
Deduplicate repeat performances in recommendation sections. No autonomous purchases or
background price monitoring are introduced.

## Implementation and validation

- [ ] Extend validated search contracts with precise time windows and party budgets.
- [ ] Parse explicit English/Chinese constraints independently of model summaries.
- [ ] Remove implicit relaxation; exclude unavailable and sold-out listings.
- [ ] Carry price evidence and trusted booking URLs through tools and cards.
- [ ] Preserve browser-tab conversations; bound state and reject stale stream updates.
- [ ] Save selected plans with explicit uncertainty, local edits and calendar downloads.
- [ ] Explain coverage and empty results; improve recommendation diversity.
- [ ] Add separately reviewable regression cases for bilingual intent, boundary times,
  budget arithmetic, malicious URLs, plan/calendar integrity and persisted-state validation.
- [ ] Run unit suite, lint, TypeScript, production build and browser flows at 375px.
- [ ] Push branch, create and attach PR, verify checks, merge with commits preserved.

Each independent correction or regression case gets its own commit. Tests exercise public
behavior and failures rather than mirroring implementation. No empty commits are permitted.
The 200-commit requirement includes individual independently testable regression additions.
