# Category Runway Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace KiwiCue's rigid bordered category grid with a borderless editorial runway and remove the black recommendation-card frame without changing filtering or recommendation behavior.

**Architecture:** Keep URL generation and data flow unchanged. Extend the data-driven `EventCategoryNav` with local decorative SVG glyphs and richer copy, then replace the grid CSS with a responsive scroll-snap runway. Restyle recommendation shells at the CSS layer so the recommendation algorithm and reusable `EventCard` remain untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, vanilla CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Do not add dependencies, APIs, tracking, accounts, or external assets.
- Preserve category URL/filter behavior and order: All, Concerts, Theatre, Markets, Festivals, Sports.
- Preserve semantic links and `aria-current="page"`; decorative SVG must be hidden from assistive technology.
- Keep all interactive targets at least 44×44 CSS pixels.
- Prevent document-level horizontal overflow at 1440px, 768px, and 375px.
- Use the existing brand green as the only saturated accent.
- Recommendation logic, reasons, ranking, and data loading remain unchanged.

---

### Task 1: Lock the category-runway contract

**Files:**
- Modify: `tests/portal-navigation.test.tsx`
- Modify: `tests/event-card.test.tsx`

**Interfaces:**
- Consumes: `EventCategoryNav(EventSearchState & { showCurrent?: boolean })`
- Produces: tests for kickers, glyphs, order, current status, borderless CSS, and scroll snap.

- [ ] **Step 1: Add failing component assertions**

```tsx
expect(within(categoryNav).getByText("Live sound")).toBeVisible();
expect(within(categoryNav).getByText("Current category")).toBeVisible();
expect(categoryNav.querySelectorAll('.event-category-glyph[aria-hidden="true"]')).toHaveLength(6);
```

- [ ] **Step 2: Replace obsolete CSS assertions**

```ts
expect(css).toMatch(/\.event-category-grid\s*\{[^}]*grid-auto-flow:\s*column/s);
expect(css).toMatch(/\.event-category-card\s*\{[^}]*border:\s*0/s);
expect(css).toMatch(/\.event-category-card\[aria-current="page"\][^}]*grid-column:\s*span\s*2/s);
expect(css).toMatch(/scroll-snap-type:\s*inline\s*mandatory/s);
expect(css).toMatch(/\.recommendation-grid\s*\{[^}]*background:\s*transparent/s);
expect(css).not.toMatch(/\.recommendation-grid\s*\{[^}]*gap:\s*1px/s);
```

- [ ] **Step 3: Confirm the tests fail**

Run: `npx vitest run tests/portal-navigation.test.tsx tests/event-card.test.tsx --maxWorkers=1`  
Expected: FAIL because current markup and CSS do not satisfy the new contract.

### Task 2: Build semantic category posters

**Files:**
- Modify: `components/event-category-nav.tsx`
- Modify: `tests/portal-navigation.test.tsx`

**Interfaces:**
- Produces: `CategoryGlyph({ category }: { category: EventCategory | "all" })`.
- Preserves: `EventCategoryNav` props and `eventSearchHref` behavior.

- [ ] **Step 1: Add local decorative glyphs**

```tsx
function CategoryGlyph({ category }: { category: EventCategory | "all" }) {
  return (
    <svg className="event-category-glyph" viewBox="0 0 64 64" focusable="false" aria-hidden="true">
      {glyphs[category]}
    </svg>
  );
}
```

Use category-specific paths without adding a dependency.

- [ ] **Step 2: Extend bilingual copy**

English kickers: `Everything`, `Live sound`, `On stage`, `Local finds`, `Big days`, `Game day`; current label: `Current category`.

Chinese kickers: `全部发现`, `现场音乐`, `舞台演出`, `社区寻宝`, `城市节庆`, `比赛现场`; current label: `当前分类`.

- [ ] **Step 3: Render the poster anatomy**

Each link renders glyph, kicker, label, description, current status, and arrow cue. Set `data-active` on the nav. Never reorder links.

- [ ] **Step 4: Run focused component tests**

Run: `npx vitest run tests/portal-navigation.test.tsx --maxWorkers=1`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add components/event-category-nav.tsx tests/portal-navigation.test.tsx
git commit -m "feat(events): turn categories into editorial posters"
```

### Task 3: Implement the borderless responsive runway

**Files:**
- Modify: `app/styles/shell.css`
- Modify: `app/styles/responsive.css`
- Modify: `app/styles/base.css`
- Modify: `tests/event-card.test.tsx`

**Interfaces:**
- Consumes: `.event-category-grid`, `.event-category-card`, `.event-category-glyph`, `.event-category-kicker`, `.event-category-current`, `.event-category-cue`.
- Produces: an asymmetric desktop runway and native mobile scroll snap.

- [ ] **Step 1: Replace equal-grid CSS**

```css
.event-category-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(9.75rem, 1fr);
  gap: var(--space-3);
  overflow-x: auto;
  padding: var(--space-2) var(--space-2) var(--space-5);
  scroll-snap-type: inline mandatory;
}
.event-category-card { min-height: 11rem; border: 0; scroll-snap-align: start; }
.event-category-card[aria-current="page"] { grid-column: span 2; }
```

- [ ] **Step 2: Style glyphs and poster typography**

Use warm neutral surfaces, the existing brand green, restrained tinted shadows, `clamp()` type, and pseudo-element geometry. The active poster uses a green surface, white text, pale glyph, and visible current status.

- [ ] **Step 3: Add responsive widths**

At `max-width: 900px`, use fixed implicit widths. At `max-width: 600px`, use approximately `48vw` inactive and `76vw` active widths, retaining a visible next-card peek.

- [ ] **Step 4: Extend reduced-motion behavior**

Disable glyph, cue, and card transforms in the existing `prefers-reduced-motion` block.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run tests/event-card.test.tsx tests/portal-navigation.test.tsx --maxWorkers=1`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add app/styles/shell.css app/styles/responsive.css app/styles/base.css tests/event-card.test.tsx
git commit -m "style(events): add a borderless category runway"
```

### Task 4: Remove the recommendation black frame

**Files:**
- Modify: `app/styles/recommendations.css`
- Modify: `tests/event-card.test.tsx`
- Modify: `e2e/recommendations.spec.ts`

**Interfaces:**
- Preserves: recommendation component props, content, ranking, and section structure.
- Produces: independent raised shells without black grid background or inherited card border.

- [ ] **Step 1: Add a failing computed-style browser assertion**

```ts
expect(await page.locator('.recommendation-grid').first().evaluate((node) => getComputedStyle(node).backgroundColor))
  .toBe('rgba(0, 0, 0, 0)');
expect(await page.locator('.recommendation-card-shell .portal-event-card').first().evaluate((node) => getComputedStyle(node).borderTopWidth))
  .toBe('0px');
```

- [ ] **Step 2: Replace the black-grid CSS**

```css
.recommendation-grid { gap: clamp(1rem, 2vw, 1.5rem); padding: 0; background: transparent; }
.recommendation-card-shell {
  overflow: hidden;
  border-radius: var(--radius-panel);
  background: var(--portal-raised);
  box-shadow: 0 16px 38px rgb(20 108 91 / 10%);
}
.recommendation-card-shell .portal-event-card { border: 0; box-shadow: none; }
```

- [ ] **Step 3: Restyle the reason strip**

Remove the bottom rule and use the soft green surface while retaining the reason dot and label.

- [ ] **Step 4: Run focused tests and commit**

Run: `npx vitest run tests/event-card.test.tsx tests/recommendations-page-content.test.tsx --maxWorkers=1`  
Expected: PASS.

```powershell
git add app/styles/recommendations.css tests/event-card.test.tsx e2e/recommendations.spec.ts
git commit -m "style(recommendations): remove the black card frame"
```

### Task 5: Verify visuals and interactions

**Files:**
- Modify: `e2e/recommendations.spec.ts`
- Modify: `e2e/portal-interactions.spec.ts`
- Create when captured (ignored): `output/playwright/category-runway-*.png`

**Interfaces:**
- Produces: regression coverage for focus, targets, scrollability, current state, and overflow.

- [ ] **Step 1: Add cross-viewport interaction checks**

Verify all six links, stable order, active `aria-current`, current status, component-level mobile overflow, 44px targets, and zero document overflow.

- [ ] **Step 2: Run focused Playwright**

Run the event-discovery and recommendation specs at 1440px, 768px, and 375px. Expected: all scenarios pass.

- [ ] **Step 3: Capture and inspect screenshots**

Capture `/events`, `/events?category=concerts`, and `/recommendations` at all three viewports. Inspect hierarchy, clipping, focus, contrast, borders, title wrapping, and empty space.

- [ ] **Step 4: Apply evidence-based polish and commit**

Fix only observed defects, then commit the E2E contract and polish.

### Task 6: Audit, merge, and update memory

**Files:**
- Modify: `D:\obsidian\10-项目\nz-news-center\*.md` outside Git
- Modify: `D:\obsidian\90-系统\长期记忆维护规则.md` if it defines memory language

**Interfaces:**
- Produces: merged PR and English-only durable project memory.

- [ ] **Step 1: Run the full quality gate**

```powershell
npm test
npm run lint
npm run test:e2e
npm audit --audit-level=high
git diff --check
```

Expected: every command exits 0, all browser projects pass, and audit reports zero high-or-greater vulnerabilities.

- [ ] **Step 2: Perform an independent read-only review**

Review the cumulative diff against `main` for functional regressions, accessibility, responsive behavior, security/privacy, CSS leakage, and test quality. Fix every Critical or Important finding and rerun affected tests.

- [ ] **Step 3: Push and merge**

Push `feat/category-discovery-refresh`, create a PR to `main`, wait for checks, merge, fast-forward local `main`, and verify the merged commit.

- [ ] **Step 4: Migrate and update Obsidian in English**

Translate the existing `nz-news-center` project notes into concise English while preserving facts and wikilinks. Add the design decision, black-grid cause, 30-pattern method, verification evidence, PR number, and next actions. Update the global memory rule so future durable memory is written in English.

- [ ] **Step 5: Clean up safely**

Remove only this task's worktree and merged feature branches. Preserve the unrelated untracked `skills-lock.json` and all other worktrees.
