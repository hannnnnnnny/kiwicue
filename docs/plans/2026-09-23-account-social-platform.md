# KiwiCue account and social platform implementation plan

## Architecture audit

- Next.js 16 App Router, React 19, strict TypeScript and modular CSS; Vercel deployment.
- Public event routes normalize Ticketmaster and curated market data into `KiwiCueEvent`; IDs are validated strings. Detail pages use `/events/[eventId]`. Movie routes use TMDB and Open Cinema separately.
- No auth or database package currently exists. The Saved provider stores validated event snapshots under `kiwicue:bookmarks:v1` in localStorage; recommendations use those local saves. Preserve this anonymous path and existing public routes.
- Vitest/Testing Library and Playwright cover the current UI. Public event API responses are shared-cacheable; new private responses must explicitly be `no-store`.
- `.env.local` exists but has no Supabase configuration. The untracked `skills-lock.json` belongs to the user and will be left alone.

## Plan

1. Add Supabase SSR browser/server/proxy clients, a narrow environment validator, and additive SQL migrations. RLS is mandatory on every user table; ownership always derives from `auth.uid()`.
2. Implement signup, login, logout, reset, session refresh, profile bootstrap, account settings, and a guarded deletion route. Test input validation and authorization before handlers.
3. Extend the current bookmark provider: guests keep local saves; authenticated users read/write cloud saves. Merge by event ID on login, confirm cloud persistence, then remove only migrated local entries. Preserve saved event snapshots for external data outages.
4. Add collections, event intent, comments with one reply level, likes/reports, follows and privacy-controlled public profiles. Use server-side validation, RLS and pagination; keep existing event cards uncluttered.
5. Add bounded activity capture, deterministic recommendations over real event results, `/for-you`, explainable reasons, a provider-neutral structured-intent parser, in-app notifications and preference controls.
6. Run unit, integration/RLS, TypeScript, lint, build and browser checks; document Supabase migration, environment and Vercel setup. Do not deploy automatically.

## Security and rollout constraints

- Default profile, collections and activity visibility to private. No browser-supplied user ID is authoritative.
- Service role is server-only and limited to account deletion; normal reads and writes use a verified session plus RLS.
- Private endpoints use `Cache-Control: private, no-store`; validate mutation origin, payload size, IDs, text lengths and URLs.
- Never display an unverified cinema release as a live Auckland session, and never invent social proof or recommendations.
- Shipping requires configured Supabase URL/publishable key, applied migrations and a production auth redirect allowlist. Until then, existing anonymous discovery remains operational.
