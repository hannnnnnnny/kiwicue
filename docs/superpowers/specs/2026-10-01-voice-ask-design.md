# Voice Ask — design

Date: 2026-10-01 · Status: approved in conversation, awaiting spec review

## Goal

Let a visitor ask KiwiCue in natural speech (or typing), in English or Chinese, and watch matching
events, movie sessions and markets stream onto the page one by one, with the best match
highlighted and a one-sentence spoken reply. Follow-ups ("make it evening", "just free ones")
refine the previous answer. Cost is capped per person and per day, with room for a paid tier.

Out of scope for this project: payments (next project, monthly subscription "KiwiCue Plus"),
new data sources, notifications, saving conversations server-side.

## Decisions

| Topic | Decision |
|---|---|
| Speech to text | Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), `zh-CN` or `en-NZ` from the site language. No key, no audio leaves the browser except through the browser vendor. Unsupported browsers get the text box only. |
| Fast judgement | TypeSafe **Jev** (`jev-latest`) via `@ai-sdk/typesafe-ai` + `experimental_evaluate` from `ai`. Evaluation only: choice / score / boolean. |
| Open-ended understanding + reply | **DeepSeek** `deepseek-flash` via `@ai-sdk/deepseek` (`generateObject` for slots, `streamText` for the reply). |
| Spoken reply | Browser `speechSynthesis`, off by default, toggle remembered in `localStorage`. |
| Entry point | Global floating mic button on every page (bottom-right on desktop, centre of the mobile tab bar) opening a full-screen overlay. |
| Scope | Events (Ticketmaster), movies (HOYTS / EVENT Cinemas sessions) and curated markets. |
| Secrets | `TYPESAFE_AI_API_KEY`, `DEEPSEEK_API_KEY`, `ASK_HASH_SALT` — server-only env vars, set by the owner locally and as Sensitive in Vercel. Never `NEXT_PUBLIC_`, never logged. |

## Architecture

```
browser                                   server (Next.js route, Node runtime)
───────                                   ─────────────────────────────────────
mic / text ──POST /api/ask {text, language, previous, turn}──▶ validate (zod, ≤300 chars)
                                                               quota.reserve()  ──▶ Supabase RPC
                                                               ┌ Jev: intent questions ┐ parallel
                                                               └ DeepSeek: slots (2.5s)┘
                                                               merge-filters
            ◀── understood {filters, chips} ─────────────────  
                                                               candidates (≤40, series grouped)
                                                               rank (exact names, Jev score)
            ◀── result × N, best ─────────────────────────────  
                                                               reply (DeepSeek stream)
            ◀── reply (text deltas) ──────────────────────────  
            ◀── done {remaining} ─────────────────────────────  quota.recordCost()
```

The response is `application/x-ndjson`: one JSON event per line. Conversation state (last filters,
up to 5 prior user turns) lives in the browser and is sent with each request; the server keeps
no conversation history.

### Stream events (`lib/ask/schema.ts`)

| Event | Payload |
|---|---|
| `understood` | `filters` (see below), `chips: {key, label}[]` in the request language |
| `result` | `AskCard` — `kind: "event" \| "movie" \| "market"`, `id`, `title`, `when`, `venue`, `href` (site-internal), `imageUrl`, `priceText`, `sessionCount`, `score` |
| `best` | `id` of the highlighted card (omitted when nothing scores ≥ 0.5) |
| `reply` | `delta` text |
| `notice` | `code` (`source_unavailable`, `ai_degraded`, …) + localized message |
| `done` | `remaining` free asks today, `tier` |
| `error` | `code` (`rate_limited`, `quota_exhausted`, `budget_exhausted`, `invalid`, `internal`) + message; the stream ends |

### Filters

`domain` (events / movies / markets / any), `dates` (concrete Auckland dates), `timeOfDay`
(any / day / evening), `area` (north / central / east / south / west / any), `category`
(music / theatre / family / sports / other / any), `kids` (bool), `free` (bool),
`names` (strings: artists, titles, venues), `place` (suburb or venue text, optional).

## Modules (`lib/ask/`)

| File | Responsibility |
|---|---|
| `schema.ts` | Zod schemas for request, filters, cards and stream events; shared by client and server. |
| `understand-jev.ts` | Builds the Jev question set (domain, when, time of day, area, category, kids, free) against state `{text, previousFilters, today}`; maps answers to partial filters. Answers with confidence < 0.6 are left unset. |
| `understand-deepseek.ts` | `generateObject` with a zod schema: `names`, `place`, `dateText`, `mode: "refine" \| "new"`. 2.5 s timeout; on timeout or error returns `null`. |
| `merge-filters.ts` | Pure: previous + Jev + DeepSeek → filters. `mode: "new"` (or words like "start over") clears previous; otherwise mentioned keys override and unmentioned keys carry over. |
| `resolve-dates.ts` | Turns "when" answers and `dateText` into Auckland calendar dates, reusing `lib/cinemas/auckland-time.ts`. |
| `candidates.ts` | Calls the existing loaders for the chosen domains, filters, groups repeat sessions with `groupEventSeries`, maps to `AskCard`, caps at 40. |
| `rank.ts` | Cards whose title matches a requested name go first; the rest are scored in one Jev call (one score question per card, rubric "irrelevant → exactly what was asked"). Jev failure → date order. |
| `reply.ts` | `streamText` on DeepSeek: one sentence in the request language naming the top result; skipped when degraded. |
| `quota.ts` | Wraps the Supabase RPCs below; computes cost from reported token usage. |
| `app/api/ask/route.ts` | Orchestration and NDJSON streaming. |

Client (`components/ask/`): `ask-button.tsx`, `ask-overlay.tsx`, `use-speech-input.ts`,
`use-ask-stream.ts`, `ask-result-card.tsx`. Mounted once in the root layout.

## Cost control

**Per-person free quota** (Auckland calendar day):

| Tier | Key | Asks per day | Burst |
|---|---|---|---|
| guest | salted SHA-256 of the client IP (`ASK_HASH_SALT`) | 5 | 10 / minute |
| free (signed in) | Supabase user id | 20 | 10 / minute |
| plus (future, paid) | user id | 200 | 10 / minute |

Limits live in one config table so they can change without a deploy.

**Global budget:** **NZ$0.50 per Auckland day and NZ$8 per Auckland calendar month**, whichever
runs out first. Both caps and the USD→NZD rate (default 1.75, deliberately pessimistic) live in an
`ask_settings` row so they can change without a deploy. Each request's cost is computed from the
token usage the two APIs report, using peak prices as an upper bound: Jev $0.04 / 1M input
tokens, output free; DeepSeek `deepseek-flash` $0.30 / 1M input (cache miss) and $1.20 / 1M
output. When either budget passes 80 % the route skips DeepSeek (Jev-only, no spoken reply,
`notice: ai_degraded`); at 100 % it returns `budget_exhausted` and the overlay offers the normal
search instead. Rough cost per ask is well under US$0.001, so the daily cap covers roughly
300 asks.

**Supabase migration `…_ask_usage.sql`:**

- `ask_limits(tier text primary key, per_day int, per_minute int)` seeded with the table above.
- `ask_settings(id int primary key check (id = 1), daily_budget_nzd_cents int default 50, monthly_budget_nzd_cents int default 800, usd_to_nzd numeric default 1.75, degrade_ratio numeric default 0.8)`.
- `ask_usage(id uuid, subject text, tier text, user_id uuid null, created_at timestamptz, cost_micro_usd int default 0, degraded bool)`,
  RLS enabled with no policies (only the server's secret key can touch it), index on `(subject, created_at)`.
- `ask_reserve(p_subject text, p_tier text, p_user uuid)` — `security definer`; in one statement
  checks the minute and day counts plus the global day and month spend and inserts a row; returns
  `{allowed, reason, usage_id, remaining, degrade}`.
- `ask_record_cost(p_usage_id uuid, p_cost int)` — updates the row after the stream finishes.
- Rows older than 40 days are deleted by the same RPC opportunistically (the month total only
  needs the current month); IPs are never stored raw.

When Supabase is not configured (local dev without accounts), the route refuses with `internal`
rather than running unmetered.

## Failure handling

| Failure | Behaviour |
|---|---|
| DeepSeek slow (> 2.5 s) or erroring | Continue with Jev only; no spoken reply; `notice: ai_degraded`. |
| Jev erroring | Filters from DeepSeek only (or none); rank by date; `notice: ai_degraded`. |
| Both AI calls fail | Keyword search over titles and venues with the previous filters. |
| One data source fails | Other sources still stream; `notice: source_unavailable` names it. |
| Quota / budget exhausted | `error` event with the reason; overlay shows sign-in (guests) or "come back tomorrow", and links to normal search. |
| Speech API unavailable or permission denied | Text box only, with a short explanation. |

Every AI and source call has a timeout; no user text is logged, only error codes.

## UI

Uses the existing Apple-style tokens (`--portal-*`, radius tokens, no `radial-gradient`).

- **Overlay:** full-screen frosted glass; Esc and a close button dismiss it; focus trapped;
  `aria-live="polite"` announces new results.
- **Listening:** mic pulses with input volume; interim transcript shown live; tap again to stop.
- **Understood chips:** removable chips (the chip field component from #103); removing one
  re-runs the ask with that filter cleared.
- **Results:** best match as a large card (image, time, venue, price, "Book" and "Details");
  others slide in 80 ms apart; `prefers-reduced-motion` shows them at once. Cards link to the
  existing event / movie pages.
- **States:** skeleton while waiting, empty state with "broaden" suggestion chips, error with
  retry, quota message with sign-in.
- **Mobile:** 375 px minimum, 44 px tap targets, no horizontal scroll.

## Privacy

- The privacy copy gains a line: typed or spoken questions are sent to TypeSafe AI (US) and
  DeepSeek (China) to understand them; no account details or location are sent.
- Only the question text, derived filters and candidate titles / times / venues go to the AI
  providers. Precise location is never sent.

## Testing

- **Unit:** merge-filters, resolve-dates, rank fallback, cost calculation, schema parsing,
  NDJSON encoder.
- **Route:** fake Jev / DeepSeek / loaders / quota covering happy path, DeepSeek timeout,
  Jev error, source failure, rate limit, budget degrade and exhaustion, invalid input.
- **Components:** streaming render order, chip removal re-asks, speech-unsupported fallback,
  reduced motion, Chinese copy.
- **E2E:** mocked `/api/ask` on desktop, tablet and mobile; no horizontal overflow; keyboard close.
- CI never calls the real AI services. A manual smoke test with real keys happens before merge.

## Delivery

Branch `feat/voice-ask`, one commit per small step, no AI co-author lines; PR opened and merged
by the implementer once CI is green. The owner adds the three secrets and runs the migration
before the feature is switched on; until then the mic button is hidden (feature flag:
the button renders only when the server reports the ask service as configured).
