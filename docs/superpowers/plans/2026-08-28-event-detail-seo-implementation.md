# Event Detail, Related Events, and SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/events/[eventId]` into a server-resolved, trustworthy event decision page with a direct facts-first hero, deterministic related events, dynamic metadata, and safe schema.org Event data.

**Architecture:** Extract one cached server-only event loader shared by the page and metadata generation, then pass the normalized event into a bilingual client presentation component so language and browser-local saving continue to work without a loading-only first paint. Related events use the existing same-origin feed plus a pure deterministic selector; SEO helpers emit only validated fields and escape JSON-LD for safe inline serialization.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, vanilla CSS, Vitest, Testing Library, Playwright

## Global Constraints

- Preserve `/events/[eventId]`, `/api/events/[eventId]`, official-source actions, browser-local saves, bilingual UI, maps, and optional distance-on-demand.
- Above the fold must answer what, when, where, verified admission, and the next action whenever those values exist.
- Hide absent organiser, admission, description, address, image, source-verification, and related-event sections; do not invent fallbacks that look like provider facts.
- Never describe related items as personalised, popular, trending, or nearby.
- Include `offers` in JSON-LD only for validated admission and include no unsupported schema property.
- Validate event ids before provider access and validate external `http/https` URLs before rendering or serializing them.
- Render provider descriptions as text; never inject provider HTML.
- Keep server credentials in server-only environment variables and expose no upstream error body or stack.
- Preserve Auckland timezone semantics, English and Chinese labels, WCAG 2.2 AA, reduced motion, and 375 px mobile behaviour.
- Add no analytics, tracking, UI framework, animation package, or external font request.
- Use test-driven red-green-refactor increments and keep `skills-lock.json` untracked.

---

## File Structure

- Create `lib/event-detail-data.ts`: cached server-only event resolution for Ticketmaster and curated market ids.
- Create `tests/event-detail-data.test.ts`: validation, curated routing, not-found, and safe failure tests.
- Modify `app/events/[eventId]/page.tsx`: server resolution, `generateMetadata`, not-found handling, JSON-LD, and initial event render.
- Create `app/events/[eventId]/error.tsx`: route-level recoverable error UI.
- Create `app/events/[eventId]/loading.tsx`: content-shaped server loading state.
- Create `lib/event-seo.ts`: validated metadata and safely serialized schema.org Event helpers.
- Create `tests/event-seo.test.ts`: exact metadata, URL, optional-field, admission, and script-escape tests.
- Create `lib/event-related.ts`: pure deterministic related-event selection.
- Create `tests/event-related.test.ts`: relevance, de-duplication, blocked/past exclusion, and stable ordering tests.
- Create `components/related-events.tsx`: independent related-feed loading/error/empty rendering.
- Modify `components/event-detail-content.tsx`: facts-first initial-event presentation and optional sections.
- Create `components/event-detail-sections.tsx`: focused hero, fact, about, location, organiser, and source sections.
- Modify `tests/event-detail-content.test.tsx`: hierarchy, omission, save, locale, source, and optional admission tests.
- Modify `app/styles/detail-saved.css`: editorial detail hero, fact rows, sections, and related cards.
- Modify `app/styles/responsive.css`: mobile detail composition and reduced motion.
- Modify `tests/event-detail-theme.test.ts`: source-level layout and focus contracts.
- Add detail journeys to the E2E structure established by Plan A.

### Task 1: Create a shared server-only detail loader

**Files:**
- Create: `lib/event-detail-data.ts`
- Create: `tests/event-detail-data.test.ts`

**Interfaces:**
- Consumes: an unknown route id, `findCuratedMarketDetail`, and `fetchAucklandEventDetail`.
- Produces: `EventPageDataError`, `loadEventPageData(eventId)`, and injectable `resolveEventPageData(eventId, dependencies)`.

- [ ] **Step 1: Write failing loader tests**

```ts
it("rejects an invalid id before either source is called", async () => {
  const loadTicketmaster = vi.fn();
  const findCurated = vi.fn();
  await expect(resolveEventPageData("../secret", { loadTicketmaster, findCurated }))
    .rejects.toMatchObject({ code: "INVALID_EVENT_ID", status: 404 });
  expect(loadTicketmaster).not.toHaveBeenCalled();
  expect(findCurated).not.toHaveBeenCalled();
});

it("resolves reserved curated ids locally", async () => {
  const findCurated = vi.fn().mockReturnValue(curatedDetail);
  const loadTicketmaster = vi.fn();
  await expect(resolveEventPageData(curatedDetail.id, { loadTicketmaster, findCurated }))
    .resolves.toEqual(curatedDetail);
  expect(loadTicketmaster).not.toHaveBeenCalled();
});

it("maps only upstream not-found to a public 404", async () => {
  const loadTicketmaster = vi.fn().mockRejectedValue(
    new TicketmasterClientError("UPSTREAM_NOT_FOUND", 404),
  );
  await expect(resolveEventPageData("event-123", { loadTicketmaster, findCurated: vi.fn() }))
    .rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
});
```

- [ ] **Step 2: Run the loader tests and confirm red**

Run: `npx vitest run tests/event-detail-data.test.ts`

Expected: FAIL because `lib/event-detail-data.ts` does not exist.

- [ ] **Step 3: Implement validated injectable resolution**

```ts
// lib/event-detail-data.ts
import "server-only";
import { cache } from "react";
import { findCuratedMarketDetail, isCuratedMarketId } from "./curated-markets";
import { parseEventId } from "./event-id";
import type { KiwiCueEventDetail } from "./events";
import { fetchAucklandEventDetail, TicketmasterClientError } from "./ticketmaster";

type Dependencies = {
  loadTicketmaster: (options: { eventId: string }) => Promise<KiwiCueEventDetail>;
  findCurated: (eventId: string) => KiwiCueEventDetail | null;
};

export class EventPageDataError extends Error {
  constructor(public readonly code: "INVALID_EVENT_ID" | "NOT_FOUND" | "UNAVAILABLE", public readonly status: number) {
    super(code);
    this.name = "EventPageDataError";
  }
}

export async function resolveEventPageData(eventId: unknown, dependencies: Dependencies): Promise<KiwiCueEventDetail> {
  const validId = parseEventId(eventId);
  if (!validId) throw new EventPageDataError("INVALID_EVENT_ID", 404);
  if (isCuratedMarketId(validId)) {
    const event = dependencies.findCurated(validId);
    if (!event) throw new EventPageDataError("NOT_FOUND", 404);
    return event;
  }
  try {
    return await dependencies.loadTicketmaster({ eventId: validId });
  } catch (error) {
    if (error instanceof TicketmasterClientError && error.code === "UPSTREAM_NOT_FOUND") {
      throw new EventPageDataError("NOT_FOUND", 404);
    }
    throw new EventPageDataError("UNAVAILABLE", 503);
  }
}

export const loadEventPageData = cache((eventId: string) => resolveEventPageData(eventId, {
  loadTicketmaster: fetchAucklandEventDetail,
  findCurated: findCuratedMarketDetail,
}));
```

- [ ] **Step 4: Run loader and API regression tests**

Run: `npx vitest run tests/event-detail-data.test.ts tests/event-detail-route.test.ts`

Expected: PASS, with provider details absent from thrown public errors.

- [ ] **Step 5: Commit the server data boundary**

```bash
git add lib/event-detail-data.ts tests/event-detail-data.test.ts
git commit -m "feat: add cached event page data loader"
```

### Task 2: Build safe dynamic metadata and Event JSON-LD

**Files:**
- Create: `lib/event-seo.ts`
- Create: `tests/event-seo.test.ts`

**Interfaces:**
- Consumes: one normalized `KiwiCueEventDetail` and a canonical site origin.
- Produces: `buildEventMetadata(event, origin)`, `buildEventJsonLd(event, origin)`, and `serializeJsonLd(value)`.

- [ ] **Step 1: Write failing SEO truth and escape tests**

```ts
it("builds event-specific metadata from validated facts", () => {
  expect(buildEventMetadata(detail, new URL("https://kiwicue.vercel.app"))).toMatchObject({
    title: "Auckland Night Live — KiwiCue",
    alternates: { canonical: "/events/event-123" },
    openGraph: { title: "Auckland Night Live — KiwiCue" },
  });
});

it("omits offers when admission is unknown", () => {
  const schema = buildEventJsonLd({ ...detail, admission: { kind: "unknown" } }, ORIGIN);
  expect(schema).not.toHaveProperty("offers");
});

it("emits zero-price NZD offers only for verified free admission", () => {
  const schema = buildEventJsonLd({ ...detail, admission: { kind: "free", currency: "NZD" } }, ORIGIN);
  expect(schema.offers).toMatchObject({ price: 0, priceCurrency: "NZD" });
});

it("escapes script-breaking JSON-LD text", () => {
  expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" }))
    .not.toContain("</script>");
});
```

- [ ] **Step 2: Run SEO tests and confirm red**

Run: `npx vitest run tests/event-seo.test.ts`

Expected: FAIL because the SEO helpers do not exist.

- [ ] **Step 3: Implement strict URL and metadata helpers**

```ts
function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}
```

`buildEventMetadata` uses `eventDisplayName(event, "en")`, a description capped at 160 Unicode code points from description/editorial summary/date/venue, canonical `/events/${encodeURIComponent(event.id)}`, and an Open Graph image only when `safeHttpUrl(event.imageUrl)` succeeds.

- [ ] **Step 4: Implement exact schema inclusion rules**

```ts
export function buildEventJsonLd(event: KiwiCueEventDetail, origin: URL) {
  const officialUrl = safeHttpUrl(event.source?.url ?? event.url);
  const location = event.venue ? {
    "@type": "Place",
    name: event.venue.name,
    ...(event.venue.address ? {
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venue.address,
        addressLocality: event.venue.city,
        postalCode: event.venue.postalCode ?? undefined,
        addressCountry: "NZ",
      },
    } : {}),
  } : undefined;
  const offers = event.admission?.kind === "free"
    ? { "@type": "Offer", price: 0, priceCurrency: "NZD", url: officialUrl }
    : event.admission?.kind === "range"
      ? { "@type": "AggregateOffer", lowPrice: event.admission.min, highPrice: event.admission.max, priceCurrency: "NZD", url: officialUrl }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.start.dateTime ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}`,
    eventStatus: schemaStatus(event.status),
    url: new URL(`/events/${encodeURIComponent(event.id)}`, origin).toString(),
    ...(safeHttpUrl(event.imageUrl) ? { image: [safeHttpUrl(event.imageUrl)] } : {}),
    ...(location ? { location } : {}),
    ...(event.organiserName ? { organizer: { "@type": "Organization", name: event.organiserName } } : {}),
    ...(offers ? { offers } : {}),
  };
}
```

`schemaStatus` maps known cancelled, postponed, rescheduled, and scheduled/onsale states to their exact schema.org URLs; unknown values omit `eventStatus` through a conditional spread.

- [ ] **Step 5: Run SEO tests**

Run: `npx vitest run tests/event-seo.test.ts`

Expected: PASS for canonical metadata, unsafe URLs, missing values, admission variants, status mapping, and script escaping.

- [ ] **Step 6: Commit SEO helpers**

```bash
git add lib/event-seo.ts tests/event-seo.test.ts
git commit -m "feat: add safe event metadata and structured data"
```

### Task 3: Server-render the primary event and route states

**Files:**
- Modify: `app/events/[eventId]/page.tsx`
- Create: `app/events/[eventId]/error.tsx`
- Create: `app/events/[eventId]/loading.tsx`
- Modify: `tests/event-detail-route.test.ts`

**Interfaces:**
- Consumes: `loadEventPageData`, metadata helpers, and `EventDetailContent.initialEvent`.
- Produces: dynamic metadata, server-resolved primary content, safe JSON-LD, not-found semantics, and a resettable error boundary.

- [ ] **Step 1: Write failing page-level tests**

```ts
it("builds dynamic metadata from the same event loader", async () => {
  const metadata = await generateMetadata(
    { params: Promise.resolve({ eventId: detail.id }) },
    vi.fn().mockResolvedValue(detail),
  );
  expect(metadata.title).toBe("Auckland Night Live — KiwiCue");
});

it("renders escaped Event JSON-LD with the initial event", async () => {
  const view = render(await EventDetailPage({
    params: Promise.resolve({ eventId: detail.id }),
    loadEvent: vi.fn().mockResolvedValue(detail),
  }));
  expect(view.container.querySelector('script[type="application/ld+json"]')?.textContent)
    .toContain('"@type":"Event"');
});
```

Expose optional loader parameters only on exported testable helpers if Next's page signature must remain exact.

- [ ] **Step 2: Run route tests and confirm red**

Run: `npx vitest run tests/event-detail-route.test.ts`

Expected: FAIL because metadata is static and the page does not load initial data.

- [ ] **Step 3: Implement the server page and metadata**

```tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  try {
    return buildEventMetadata(await loadEventPageData(eventId), siteOrigin());
  } catch (error) {
    if (error instanceof EventPageDataError && error.status === 404) return { title: "Event not found — KiwiCue" };
    return { title: "Event details — KiwiCue" };
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  let event: KiwiCueEventDetail;
  try {
    event = await loadEventPageData(eventId);
  } catch (error) {
    if (error instanceof EventPageDataError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: serializeJsonLd(buildEventJsonLd(event, siteOrigin())),
      }} />
      <EventDetailContent initialEvent={event} />
    </>
  );
}
```

`siteOrigin()` returns `new URL("https://kiwicue.vercel.app")`, the production origin documented in `README.md`; it never trusts request or query input.

- [ ] **Step 4: Implement loading and recoverable error files**

```tsx
// app/events/[eventId]/error.tsx
"use client";

export default function EventDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="event-detail-page">
      <PortalHeader skipTarget="event-detail" currentPage="events" />
      <section id="event-detail" className="event-state event-error" role="alert">
        <p className="state-code" aria-hidden="true">DETAIL / RETRY</p>
        <h1>Event details are temporarily unavailable</h1>
        <p>The official event feed could not be refreshed. Try again in a moment.</p>
        <button type="button" onClick={reset}>Retry event details</button>
      </section>
    </main>
  );
}
```

`loading.tsx` uses the same `event-detail-page`, header, `role="status"`, `aria-busy="true"`, reserved artwork ratio, and facts skeleton classes as the finished layout.

- [ ] **Step 5: Run route, metadata, and loading/error tests**

Run: `npx vitest run tests/event-detail-route.test.ts tests/event-seo.test.ts`

Expected: PASS, with not-found mapping and no upstream detail leakage.

- [ ] **Step 6: Commit server-first detail rendering**

```bash
git add app/events/[eventId]/page.tsx app/events/[eventId]/error.tsx app/events/[eventId]/loading.tsx tests/event-detail-route.test.ts
git commit -m "feat: server render event detail pages"
```

### Task 4: Recompose the facts-first detail experience

**Files:**
- Modify: `components/event-detail-content.tsx`
- Modify: `tests/event-detail-content.test.tsx`

**Interfaces:**
- Consumes: `initialEvent: KiwiCueEventDetail`, language context, bookmark context, map and distance components.
- Produces: a no-refetch primary detail hierarchy with optional About, Date and time, Location, Organiser, Source, and admission rows.

- [ ] **Step 1: Replace loading-centric tests with initial-event hierarchy tests**

```tsx
it("answers what, when, where and next action above the fold", () => {
  const view = renderDetail({ ...detail, admission: { kind: "range", currency: "NZD", min: 35, max: 65 } });
  const hero = view.container.querySelector(".event-detail-hero")!;
  expect(within(hero).getByRole("heading", { level: 1, name: "Auckland Night Live" })).toBeVisible();
  expect(within(hero).getByText("Sat, 8 Aug · 7:30 pm")).toBeVisible();
  expect(within(hero).getByText("The Civic · Auckland")).toBeVisible();
  expect(within(hero).getByText("NZ$35–NZ$65")).toBeVisible();
  expect(within(hero).getByRole("link", { name: "Continue to official booking" })).toBeVisible();
});

it("omits optional fact sections instead of inventing provider facts", () => {
  renderDetail({ ...detail, description: null, note: null, organiserName: undefined, admission: undefined });
  expect(screen.queryByRole("heading", { name: "About" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Organiser" })).not.toBeInTheDocument();
  expect(screen.queryByText(/price unavailable|free/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run detail component tests and confirm red**

Run: `npx vitest run tests/event-detail-content.test.tsx`

Expected: FAIL because the component still fetches and renders fallback description copy.

- [ ] **Step 3: Convert the component to initial-event rendering**

```tsx
export function EventDetailContent({ initialEvent }: { initialEvent: KiwiCueEventDetail }) {
  const { language } = useLanguage();
  const event = initialEvent;
  const officialUrl = safeExternalEventUrl(event.source?.url ?? event.url);
  const admission = formatEventAdmission(event.admission, language);
  return (
    <main className="event-detail-page">
      <PortalHeader skipTarget="event-detail" currentPage="events" />
      <article id="event-detail" className="event-detail-shell" aria-labelledby="event-detail-title">
        <EventDetailHero event={event} language={language} officialUrl={officialUrl} admission={admission} />
        <div className="event-detail-body">
          {eventDisplayDescription(event, language) && <EventAbout event={event} language={language} />}
          <EventDateTime event={event} language={language} />
          {event.venue && <EventLocation event={event} language={language} />}
          {event.organiserName && <EventOrganiser name={event.organiserName} language={language} />}
          {officialUrl && <EventSourceSection event={event} url={officialUrl} language={language} />}
        </div>
        <RelatedEvents event={event} />
      </article>
    </main>
  );
}
```

Move `EventDetailHero`, `EventAbout`, `EventDateTime`, `EventLocation`, `EventOrganiser`, and `EventSourceSection` into `components/event-detail-sections.tsx`. Export a `safeExternalEventUrl(value: string): string | null` helper that accepts only `http:` and `https:` URLs; omit the primary action when it returns null.

- [ ] **Step 4: Preserve bilingual, save, map, and source behaviour**

Keep `BookmarkButton`, `EventEditorialPreviewMedia`, `EventMap`, `DistancePanel`, curated verification, and `MarketPastHighlights`. Replace the old generic booking-instruction block with concise factual sections. Format admission as `Free`/`免费` or `NZ$35–NZ$65`; do not render unknown admission.

- [ ] **Step 5: Run component regressions**

Run: `npx vitest run tests/event-detail-content.test.tsx tests/bookmark-button.test.tsx tests/event-map.test.tsx tests/distance-panel.test.tsx tests/bilingual-pages.test.tsx`

Expected: PASS for the hierarchy, optional omission, curated details, save, no automatic location access, safe source actions, and language switching without refetching.

- [ ] **Step 6: Commit the detail composition**

```bash
git add components/event-detail-content.tsx components/event-detail-sections.tsx tests/event-detail-content.test.tsx
git commit -m "feat: redesign event details around essential facts"
```

### Task 5: Add deterministic related events

**Files:**
- Create: `lib/event-related.ts`
- Create: `tests/event-related.test.ts`
- Create: `components/related-events.tsx`
- Modify: `tests/event-detail-content.test.tsx`

**Interfaces:**
- Consumes: current event, candidate events, explicit `now`, and the same-origin events API.
- Produces: `selectRelatedEvents(current, candidates, now, limit = 4)` and `RelatedEvents({ event })`.

- [ ] **Step 1: Write failing deterministic selector tests**

```ts
it("prefers same category then venue, excludes invalid candidates, and stays stable", () => {
  const candidates = [sameVenue, sameCategory, unrelated, current, past, cancelled, duplicate];
  expect(selectRelatedEvents(current, candidates, NOW).map(({ id }) => id))
    .toEqual([sameVenue.id, sameCategory.id, unrelated.id]);
  expect(selectRelatedEvents(current, [...candidates].reverse(), NOW).map(({ id }) => id))
    .toEqual([sameVenue.id, sameCategory.id, unrelated.id]);
});
```

- [ ] **Step 2: Run selector tests and confirm red**

Run: `npx vitest run tests/event-related.test.ts`

Expected: FAIL because `selectRelatedEvents` does not exist.

- [ ] **Step 3: Implement the pure selector**

```ts
export function selectRelatedEvents(
  current: KiwiCueEvent,
  candidates: KiwiCueEvent[],
  now: Date,
  limit = 4,
): KiwiCueEvent[] {
  const nowMs = now.getTime();
  const seen = new Set([current.id]);
  return candidates.flatMap((event) => {
    const start = eventInstantMilliseconds(event);
    const blocked = ["cancelled", "postponed", "offsale"].includes(event.status.toLowerCase());
    if (seen.has(event.id) || start === null || start < nowMs || blocked) return [];
    seen.add(event.id);
    const score = (categoryKey(event) === categoryKey(current) ? 8 : 0)
      + (event.venue?.id && event.venue.id === current.venue?.id ? 12 : 0)
      + (event.imageUrl ? 2 : 0)
      + (event.source || event.editorialPreview ? 1 : 0);
    return [{ event, start, score }];
  }).sort((a, b) => b.score - a.score || a.start - b.start || a.event.id.localeCompare(b.event.id))
    .slice(0, Math.max(0, Math.min(limit, 8)))
    .map(({ event }) => event);
}
```

- [ ] **Step 4: Implement independent related-feed states**

`RelatedEvents` maps the current provider category to an existing supported KiwiCue category, fetches `/api/events?size=12&category=<validated>` with an `AbortController`, selects up to four items, and renders:

```tsx
if (state.status === "loading") return <section aria-labelledby="related-title" aria-busy="true"><h2 id="related-title">More like this</h2><EventGridSkeleton count={4} /></section>;
if (state.status === "error") return <section aria-labelledby="related-title"><h2 id="related-title">More like this</h2><button type="button" onClick={retry}>Retry related events</button></section>;
if (state.events.length === 0) return null;
return <section aria-labelledby="related-title"><h2 id="related-title">More like this</h2><div className="event-related-grid">{state.events.map((event) => <EventCard key={event.id} event={event} variant="standard" />)}</div></section>;
```

Use bilingual copy and never hide the primary detail when this request fails.

- [ ] **Step 5: Run related and detail tests**

Run: `npx vitest run tests/event-related.test.ts tests/event-detail-content.test.tsx`

Expected: PASS for ordering, de-duplication, abort cleanup, independent retry, empty omission, and both locales.

- [ ] **Step 6: Commit related discovery**

```bash
git add lib/event-related.ts components/related-events.tsx tests/event-related.test.ts tests/event-detail-content.test.tsx
git commit -m "feat: add deterministic related events"
```

### Task 6: Apply the responsive event-detail visual system

**Files:**
- Modify: `app/styles/detail-saved.css`
- Modify: `app/styles/responsive.css`
- Modify: `tests/event-detail-theme.test.ts`
- Modify: `tests/portal-accessibility-contract.test.tsx`

**Interfaces:**
- Consumes: detail hero, fact list, body sections, and related-grid classes.
- Produces: artwork-left/facts-right desktop layout, deliberate mobile composition, visible focus, and reduced-motion-safe interaction.

- [ ] **Step 1: Write failing detail layout invariants**

```ts
it("uses an artwork and facts grid without a boxed black border", () => {
  const css = readDetailCss();
  expect(css).toMatch(/\.event-detail-hero\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(20rem,\s*0\.85fr\)/s);
  expect(css).not.toMatch(/\.event-detail-shell\s*{[^}]*border:\s*1px\s+solid\s+(?:#000|var\(--ink\))/s);
});

it("keeps the primary action and focus visible on mobile", () => {
  const css = readResponsiveCss();
  expect(css).toMatch(/@media\s*\(max-width:\s*639px\)[\s\S]*\.event-detail-hero[^{]*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  expect(css).toMatch(/\.event-detail-page[^}]*:focus-visible/);
});
```

- [ ] **Step 2: Run theme tests and confirm red**

Run: `npx vitest run tests/event-detail-theme.test.ts tests/portal-accessibility-contract.test.tsx`

Expected: FAIL until the new detail layout rules exist.

- [ ] **Step 3: Implement desktop detail hierarchy**

```css
.event-detail-shell {
  width: min(100% - 2rem, 82rem);
  margin-inline: auto;
  padding-block: clamp(2rem, 6vw, 6rem);
}

.event-detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(20rem, 0.85fr);
  gap: clamp(1.5rem, 4vw, 4.5rem);
  align-items: start;
}

.event-detail-fact-list {
  margin: 0;
  border-block: 1px solid var(--events-line);
}

.event-detail-fact {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1rem;
  padding-block: 0.9rem;
  border-bottom: 1px solid var(--events-line);
}

.event-related-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
```

- [ ] **Step 4: Implement mobile and focus rules**

```css
@media (max-width: 639px) {
  .event-detail-hero,
  .event-related-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .event-detail-fact {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }

  .event-detail-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

.event-detail-page :focus-visible {
  outline: 3px solid var(--events-accent);
  outline-offset: 3px;
}
```

Reuse Plan A's reduced-motion block and warm neutral tokens; do not add another accent palette.

- [ ] **Step 5: Run theme and accessibility tests**

Run: `npx vitest run tests/event-detail-theme.test.ts tests/portal-accessibility-contract.test.tsx`

Expected: PASS with the desktop grid, mobile stack, 44 px actions, focus visibility, and no black shell border.

- [ ] **Step 6: Commit detail styling**

```bash
git add app/styles/detail-saved.css app/styles/responsive.css tests/event-detail-theme.test.ts tests/portal-accessibility-contract.test.tsx
git commit -m "style: polish responsive event detail pages"
```

### Task 7: Verify detail, SEO, and release readiness

**Files:**
- Modify: `e2e/events-editorial.spec.ts`
- Modify: implementation files only for defects demonstrated by verification.

**Interfaces:**
- Consumes: the finished server-rendered detail route.
- Produces: automated and visual evidence for the final PR gate.

- [ ] **Step 1: Add critical detail browser journeys**

```ts
test("event detail exposes essential facts and a safe official action", async ({ page }) => {
  await page.goto("/events/event-123");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const official = page.getByRole("link", { name: /official|booking/i }).first();
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(official).toHaveAttribute("rel", /noopener/);
  const schema = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(schema ?? "{}")).toMatchObject({ "@type": "Event" });
});
```

Add cases for a curated market, missing image/admission/organiser, Chinese locale, 404, recoverable error fixture, related-feed failure, keyboard save/action flow, reduced motion, and screenshots at 1440×1000 and 375×812.

- [ ] **Step 2: Run all automated release gates**

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS with no warnings from changed files.

Run: `npm run build`

Expected: PASS, with dynamic event pages and metadata compiling successfully.

Run: `npm run test:e2e`

Expected: PASS for discovery, results, detail, locale, keyboard, and responsive journeys.

- [ ] **Step 3: Inspect final screenshots and page source**

Confirm the detail page answers what/when/where/admission/action above the fold when data exists; optional sections disappear without holes; the mobile CTA and focus remain visible; related-feed failure leaves the main detail intact; page source contains event-specific metadata and parseable escaped JSON-LD; and no invented popular/free/nearby claims appear.

- [ ] **Step 4: Run hygiene and security checks**

Run: `git diff --check`

Expected: no output.

Run: `rg -n "console\.log|dangerouslySetInnerHTML|API_KEY|TOKEN|SECRET" app components lib tests --glob '!**/*.snap'`

Expected: no production `console.log`; the only new `dangerouslySetInnerHTML` is the reviewed escaped JSON-LD site; no credential value is present.

Run: `git status --short`

Expected: only intentional tracked files; no screenshots, environment files, `skills-lock.json`, or temporary artifacts.

- [ ] **Step 5: Commit final browser coverage**

```bash
git add e2e/events-editorial.spec.ts
git commit -m "test: verify event detail and SEO journeys"
```
