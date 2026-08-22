# Cinema Brand Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add locally hosted, source-audited official cinema brand marks and accessible session/map icons to the Auckland cinema directory.

**Architecture:** Curated cinema records reference bounded local asset paths; a focused `CinemaBrandMark` component owns image failure fallback. The directory composes that component with dependency-free inline SVG action icons, while existing search, distance, privacy, and external-link behavior remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Next Image, CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Official brand assets come only from cinema-controlled pages or assets loaded by those pages.
- Assets are stored under `public/cinemas/`; KiwiCue never hotlinks them at runtime.
- Brand marks identify linked cinemas and must not imply partnership or endorsement.
- No new dependency, remote request, tracking, schedule scraping, or business-logic change.
- All links retain explicit accessible names, `noopener noreferrer`, and 44 by 44 pixel touch targets.
- The directory must not overflow at 375, 768, or desktop widths.
- Preserve the user-owned untracked `skills-lock.json`.

---

### Task 1: Curate official local brand assets

**Files:**
- Create: `public/cinemas/academy.png`
- Create: `public/cinemas/event.png`
- Create: `public/cinemas/hoyts.png`
- Create: `public/cinemas/reading.svg`
- Create: `public/cinemas/bridgeway.png`
- Create: `public/cinemas/capitol.png`
- Create: `public/cinemas/lido.png`
- Create: `public/cinemas/rialto.png`
- Create: `public/cinemas/SOURCES.md`
- Test: `tests/cinema-brand-assets.test.ts`

**Interfaces:**
- Produces: local `/cinemas/<brand>.<ext>` paths consumed by `AucklandCinema.brandAsset`.
- Produces: a source manifest recording the exact official page and asset URL for every copied mark.

- [ ] **Step 1: Write the failing asset-integrity test**

```ts
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const assets = ["academy.png", "event.png", "hoyts.png", "reading.svg", "bridgeway.png", "capitol.png", "lido.png", "rialto.png"];

describe("cinema brand assets", () => {
  it.each(assets)("ships a non-empty local %s asset", (name) => {
    const path = resolve(process.cwd(), "public", "cinemas", name);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(100);
  });

  it("records official sources for every copied asset", () => {
    const manifest = readFileSync(resolve(process.cwd(), "public/cinemas/SOURCES.md"), "utf8");
    for (const name of assets) expect(manifest).toContain(`\`${name}\``);
  });
});
```

- [ ] **Step 2: Run the test and verify missing assets fail**

Run: `npx vitest run tests/cinema-brand-assets.test.ts --maxWorkers=1`

Expected: FAIL because `public/cinemas/` assets do not exist.

- [ ] **Step 3: Download only the audited official assets**

Create `public/cinemas/`, then download these exact sources without sending cookies or credentials:

```text
academy.png  https://cdn.vwassets.com/academycinemas.co.nz/1491085808806_academylogo.png
event.png    https://cdn.eventcinemas.co.nz/cdn/content/img/icons/apple-icon-180x180.png
hoyts.png    https://www.hoyts.co.nz/apple-touch-icon.png
reading.svg  https://d2apwscfoijj3f.cloudfront.net/assets/images/reading-cinemas-logo-white.svg
bridgeway.png https://cdn.vwassets.com/bridgeway.co.nz/1691382267615_bridgewaylogo.png
capitol.png  https://cdn.vwassets.com/thecapitol.co.nz/1557886440149_capitollogo.png
lido.png     https://www.lido.co.nz/apple-touch-icon.png
rialto.png   https://cdn.rialto.co.nz/cdn/content/img/icons/apple-icon-180x180.png
```

Reject any response that is not an image or exceeds 1 MB. Record each source URL, official page URL, retrieval date `2026-08-23`, and identification-only purpose in `public/cinemas/SOURCES.md`. Silky Otter uses initials fallback because its official site blocks asset retrieval and no reusable official mark was verified.

- [ ] **Step 4: Verify assets and manifest**

Run: `npx vitest run tests/cinema-brand-assets.test.ts --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit the asset boundary**

```bash
git add public/cinemas tests/cinema-brand-assets.test.ts
git commit -m "assets: add audited cinema brand marks"
```

---

### Task 2: Add typed cinema brand metadata

**Files:**
- Modify: `lib/cinema-directory.ts`
- Modify: `tests/cinema-directory.test.ts`

**Interfaces:**
- Produces: `AucklandCinema.brandAsset: string | null` and `AucklandCinema.brandLabel: string`.
- Consumes: local asset paths created by Task 1.

- [ ] **Step 1: Add failing metadata assertions**

```ts
it("uses bounded local brand assets with deterministic fallbacks", () => {
  for (const cinema of AUCKLAND_CINEMAS) {
    expect(cinema.brandLabel).toMatch(/^[A-Z0-9]{1,3}$/);
    expect(cinema.brandAsset === null || /^\/cinemas\/[a-z-]+\.(?:png|svg)$/.test(cinema.brandAsset)).toBe(true);
  }
  expect(AUCKLAND_CINEMAS.find(({ id }) => id === "silky-otter-orakei")?.brandAsset).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify the type/data failure**

Run: `npx vitest run tests/cinema-directory.test.ts --maxWorkers=1`

Expected: FAIL because `brandAsset` and `brandLabel` do not exist.

- [ ] **Step 3: Extend the curated model and records**

```ts
export type AucklandCinema = {
  id: string;
  name: string;
  chain: string;
  brandAsset: string | null;
  brandLabel: string;
  suburb: string;
  address: string;
  coordinates: EventCoordinates;
  sessionsUrl: string;
};
```

Reuse one local asset for every cinema in the same chain. Use labels `AC`, `EC`, `H`, `RC`, `B`, `C`, `L`, `R`, and `SO`.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run tests/cinema-directory.test.ts --maxWorkers=1`

Expected: PASS.

- [ ] **Step 5: Commit typed metadata**

```bash
git add lib/cinema-directory.ts tests/cinema-directory.test.ts
git commit -m "feat(movies): model cinema brand identity"
```

---

### Task 3: Render resilient brand marks and action icons

**Files:**
- Create: `components/cinema-brand-mark.tsx`
- Modify: `components/cinema-directory.tsx`
- Modify: `tests/cinema-directory-component.test.tsx`

**Interfaces:**
- Produces: `CinemaBrandMark({ asset, label, cinemaName }: { asset: string | null; label: string; cinemaName: string })`.
- Consumes: `AucklandCinema.brandAsset` and `AucklandCinema.brandLabel` from Task 2.

- [ ] **Step 1: Write failing component tests**

```tsx
expect(screen.getByTestId("cinema-brand-academy").querySelector("img")).toHaveAttribute("src", expect.stringContaining("academy.png"));
expect(screen.getByTestId("cinema-brand-silky-otter-orakei")).toHaveTextContent("SO");
expect(screen.getByRole("link", { name: "Academy Cinemas sessions" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
expect(screen.getByRole("link", { name: "Map for Academy Cinemas" }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
```

Add an image-error assertion that fires `error` on Academy's image and expects `AC` to replace it.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run tests/cinema-directory-component.test.tsx --maxWorkers=1`

Expected: FAIL because no mark component or SVG action icons exist.

- [ ] **Step 3: Implement the focused mark component**

```tsx
"use client";

import Image from "next/image";
import { useState } from "react";

export function CinemaBrandMark({ asset, label, cinemaId }: {
  asset: string | null;
  label: string;
  cinemaId: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="cinema-brand-mark" data-testid={`cinema-brand-${cinemaId}`} aria-hidden="true">
      {asset && !failed ? <Image src={asset} alt="" width={96} height={96} onError={() => setFailed(true)} /> : <span>{label}</span>}
    </span>
  );
}
```

Pass the stable cinema `id`, not the display name, as `cinemaId` from `CinemaDirectory`. Implement the ticket/screen and pin icons as small local functions returning inline SVG with `focusable="false"` and `aria-hidden="true"`.

- [ ] **Step 4: Run the focused component test**

Run: `npx vitest run tests/cinema-directory-component.test.tsx --maxWorkers=1`

Expected: PASS with official mark, initials fallback, image-error fallback, and both accessible action links intact.

- [ ] **Step 5: Commit the component behavior**

```bash
git add components/cinema-brand-mark.tsx components/cinema-directory.tsx tests/cinema-directory-component.test.tsx
git commit -m "feat(movies): render resilient cinema marks"
```

---

### Task 4: Polish responsive card layout

**Files:**
- Modify: `app/styles/movies.css`
- Modify: `app/styles/responsive.css`
- Modify: `e2e/portal-interactions.spec.ts`

**Interfaces:**
- Consumes: `.cinema-brand-mark`, `.cinema-directory-identity`, and existing `.cinema-directory-actions` markup from Task 3.
- Produces: 48 pixel desktop and 40 pixel mobile marks without card overflow.

- [ ] **Step 1: Extend the E2E assertions before CSS**

```ts
await expect(page.locator(".cinema-brand-mark").first()).toBeVisible();
const mark = await page.locator(".cinema-brand-mark").first().boundingBox();
expect(mark?.width).toBe(testInfo.project.name === "mobile-375" ? 40 : 48);
expect(mark?.height).toBe(testInfo.project.name === "mobile-375" ? 40 : 48);
await expectNoHorizontalOverflow(page);
```

- [ ] **Step 2: Run the movie E2E case and verify size assertions fail**

Run: `npm run test:e2e -- --grep "movie search, dates, distance"`

Expected: FAIL because the new mark has no final dimensions/layout.

- [ ] **Step 3: Add responsive styles using existing tokens**

```css
.cinema-directory-identity {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.cinema-brand-mark {
  inline-size: 48px;
  block-size: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: var(--radius-control);
  background: var(--portal-brand-soft);
  color: var(--portal-ink);
  font-weight: 750;
}

.cinema-brand-mark img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}

@media (max-width: 639px) {
  .cinema-directory-identity {
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .cinema-brand-mark {
    inline-size: 40px;
    block-size: 40px;
  }
}
```

- [ ] **Step 4: Re-run focused E2E**

Run: `npm run test:e2e -- --grep "movie search, dates, distance"`

Expected: PASS at 375, 768, and desktop widths, with all touch targets at least 44 pixels.

- [ ] **Step 5: Commit responsive styling**

```bash
git add app/styles/movies.css app/styles/responsive.css e2e/portal-interactions.spec.ts
git commit -m "style(movies): clarify cinema directory actions"
```

---

### Task 5: Full verification, PR, and production check

**Files:**
- Modify only if a verification failure identifies a defect in the files above.

**Interfaces:**
- Consumes: all deliverables from Tasks 1 through 4.
- Produces: merged issue #79 with a production deployment verified in a real browser.

- [ ] **Step 1: Run complete verification**

```text
npm test
npm run lint
npm run build
npm run test:e2e
```

Expected: 496 or more unit/component tests, four static checks, lint and production build pass; all 51 or more E2E tests pass.

- [ ] **Step 2: Inspect the diff and secret boundary**

Run: `git diff --check`, `git status --short`, and search for remote logo URLs outside `public/cinemas/SOURCES.md`.

Expected: no whitespace errors, no credential values, no runtime hotlinks, and only the user-owned `skills-lock.json` remains untracked.

- [ ] **Step 3: Push and open the PR**

Push `feat/cinema-brand-icons`, open a PR titled `feat: add cinema brand marks`, include test results, and close #79.

- [ ] **Step 4: Wait for Vercel checks, merge, and sync main**

Expected: Vercel Preview passes before merge; the merge commit reaches `main` and the production deployment succeeds.

- [ ] **Step 5: Verify production with a real browser**

Check `/movies` in English and Chinese at 375, 768, and desktop widths. Confirm official marks/fallbacks render, session and map links open safely, and `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
