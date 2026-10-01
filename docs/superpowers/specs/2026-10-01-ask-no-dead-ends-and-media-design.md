# Kiwi: no dead ends, then pictures and trailers

Two follow-ups to the Kiwi chat, shipped as two PRs in this order.

## Part 1 — no dead ends

### Problem

A confirmed plan of "Wednesday · with kids · central · music · under $30" returned nothing and
the thread stopped at a grey "Nothing matched" line:

- `kids` meant "event section is family" and `music` meant "event section is music", so asking
  for both could never match.
- Every filter was a hard condition, so one extra detail emptied the results.
- Nothing invited the visitor to carry on, with or without results.
- Budgets ("under 30") were dropped because only `free` existed.

### Design

**Kids is soft beside a category.** When a category is set, `kids` no longer filters events; Jev's
ranking already sees `kids` in the filters. Without a category it still means the family section.
Film ratings (G/PG) still apply to movies.

**Budget.** `AskFilters.maxPrice: number | null` (NZD, 1–1000, defaults to null so older clients
still validate). DeepSeek's slot extraction returns it ("under 30", "30块以内" → 30). An event is
dropped only when its lowest known price is above it; free and unknown prices stay. Chip:
"≤ $30" / "30 元以内".

**Relaxation ladder.** When the filtered candidates are empty, the server removes one set filter
at a time, cumulatively, in this order, and stops at the first step with results:

`maxPrice → area → timeOfDay → kids → category → free`

If that still finds nothing and dates were set, it fetches again with each date widened by ±3
days (never before today) and repeats the ladder from the full filter set, so "Thursday, central
music" beats "any music on Wednesday". `domain`, `names` and `place` (already soft) are never
removed.

`loadCandidates` returns `relaxed: string[]` (chip keys). The pipeline emits a new stream event
`{ type: "relaxed", keys }` before the results, and passes the dropped chip labels to the reply
prompt so Kiwi says what it loosened before naming the closest option.

**UI.** Relaxed chips render struck through with "(dropped)" for screen readers, and a line
"No exact match — here are the closest." heads the cards.

**Kiwi keeps talking.** When a search finishes, the chat appends a `followup` entry: one question
plus up to three refinements and "Start over".

- Refinements are phrases the existing understanding maps cleanly, chosen from the current
  filters: "Anywhere in Auckland" (area set), "Any day this week" (dates set), "In the evening"
  (time any), "Only free ones" (not free), "Any kind of event" (category set).
- Tapping a refinement adds it as a user message and runs a refining search (previous filters +
  that text), as a new results message.
- "Start over" adds Kiwi's greeting question with the starter replies; the next message goes to
  the chat API with a fresh window.
- Kiwi speaks the search's one-sentence reply followed by the follow-up question; after a voice
  turn it listens again.

Copy (en / zh):

| Case | en | zh |
| --- | --- | --- |
| results | Want me to tweak anything? | 要不要再调整一下？ |
| relaxed | Nothing matched exactly, so these are the closest. Want to adjust? | 没有完全符合的，这些是最接近的。要调整一下吗？ |
| none | I couldn't find anything, even after loosening it. Try one of these? | 放宽条件后还是没找到，试试这些？ |

### Testing

Candidates: music + kids returns music events; maxPrice filtering; each ladder step; date
widening with a second fetch. Pipeline: `relaxed` event order and reply prompt. Merge/DeepSeek:
`maxPrice`. Stream state: `relaxed`. Chat state: follow-up options, refine and restart. Overlay:
struck chips, closest heading, refine button runs a search. E2E: a relaxed search shows the
heading and a follow-up.

## Part 2 — pictures and trailers

- **Best match:** a 16:9 hero. Events use their image. A movie with a trailer embeds
  `youtube-nocookie.com/embed/{key}?autoplay=1&mute=1&playsinline=1&loop=1&playlist={key}`;
  "🔊 Sound on" reloads it unmuted and stops Kiwi's voice. With `prefers-reduced-motion` or
  Save-Data, or without a trailer, it shows the poster with a ▶ button instead.
- **Other cards:** a 64×64 rounded thumbnail; a neutral placeholder when there is no image.
- **Movie media:** after the result events, the server looks up up to six movie cards on TMDB
  (`/search/movie`, region NZ), accepting only an exact normalised-title match, and the trailer
  (existing `selectTmdbTrailer`) for the best match only. It streams
  `{ type: "media", id, imageUrl, trailerKey }`, so cards are never delayed. Lookups are cached
  in memory for 6 hours; missing token or TMDB failure is logged and skipped.
- **Safety:** trailer keys must match `^[A-Za-z0-9_-]{11}$`, images must start with
  `https://image.tmdb.org/`, checked on both sides. The CSP already allows the frame and images.
  A small "Images: TMDB" credit appears under results that use TMDB media.
- **Testing:** title matching, TMDB lookup (mocked) with failure and cache, `media` event
  validation and merge, hero states (image, autoplay trailer, reduced motion, none), e2e iframe
  `src` and no horizontal overflow on three viewports.
