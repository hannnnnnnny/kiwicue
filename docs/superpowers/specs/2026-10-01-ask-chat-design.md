# Ask chat with Kiwi — design

Date: 2026-10-01 · Status: approved in conversation · Builds on `2026-10-01-voice-ask-design.md`

## Goal

Replace "one utterance → immediate search" with a short spoken conversation. A round character,
Kiwi, asks one question at a time until it knows enough, shows what it will search for, and
searches only after the visitor confirms. Kiwi speaks its lines and listens for the answer, so the
whole exchange can happen by voice.

## Decisions

| Topic | Decision |
|---|---|
| Conversation style | Free chat (option B). Kiwi asks one question per turn and offers 2–4 quick replies. |
| Length | At most 6 visitor turns; on the 6th Kiwi stops asking and proposes the search. |
| Confirmation | When ready, Kiwi shows a confirmation card (summary + "Search" / "Change something"). Search runs only on "Search". |
| After results | The conversation continues; a refinement goes through Kiwi again and needs a new confirmation. |
| Character | A round orb with two eyes and a mouth. States: `idle`, `listening`, `thinking`, `speaking`. CSS/SVG only, no `radial-gradient`, static under `prefers-reduced-motion`. |
| Name | Kiwi. Greeting: "Hi, I'm Kiwi! What are you in the mood for in Auckland?" / "嗨，我是 Kiwi！想在奥克兰找点什么好玩的？" |
| Voice out | Browser `speechSynthesis` behind a `Voice` interface so a cloud TTS can replace it later. On by default with a mute toggle (remembered). The best available voice for the language is chosen (prefers names containing Natural / Premium / Enhanced / Google / Siri). |
| Voice in | Continuous recognition. After ~2 s of silence the transcript is sent automatically; tapping the mic ends and sends immediately. After Kiwi finishes speaking, if the visitor last used the mic, listening restarts automatically. Typed text is never sent automatically. |
| Model | DeepSeek `deepseek-flash`, thinking disabled, structured output. Jev and the existing search pipeline are unchanged. |

## Chat turn API

`POST /api/ask/chat` — JSON in, JSON out (a turn is short; no streaming).

Request: `{ language: "en" | "zh", messages: { role: "user" | "assistant", text: string }[] }`
- 1–12 messages, the last one from the user, text ≤ 300 characters, at most 6 user messages.

Response: `{ reply: string, quickReplies: string[], ready: boolean, summary: string | null, searchText: string | null, remaining: number }`
- `reply` ≤ 200 characters, in the request language.
- `quickReplies` 0–4 items, each ≤ 30 characters.
- When `ready`, `summary` is a short line such as "Sat 3 Oct · with kids · East · under $30" and `searchText` is one sentence carrying every detail gathered, in the request language. On the 6th user turn the server forces `ready` (if the model did not) and falls back to joining the user messages for `searchText`.
- Errors: `{ error: { code, message } }` with 400 / 429 / 503, same codes as `/api/ask`.

Confirming sends `searchText` to the existing `/api/ask` with the user messages as `history` and `previous: null`.

## Quota and cost

- Free quotas keep counting **searches** only (guest 5, free 20, plus 200 per Auckland day).
- Chat turns have their own daily cap per person (`chat_per_day`, default 60) and share the per-minute burst limit (raised to 20 so a full conversation plus a search fits).
- Chat turns are costed like everything else and count toward the NZ$0.50/day and NZ$8/month budgets. At 80 % of either budget the chat endpoint answers with `ready: true` straight away, so the visitor goes to search without spending on more turns; at 100 % it returns `budget_exhausted`.
- Migration `202610010002_ask_chat.sql`: adds `ask_usage.kind` (`search` | `chat`, default `search`) and `ask_limits.chat_per_day`, sets `per_minute` to 20, and replaces `ask_reserve` with a version taking `p_kind text default 'search'` (the old three-argument calls keep working). Estimated cost per full conversation ≈ US$0.0026.

## Client

- `use-ask-chat.ts`: messages, pending turn, quick replies, ready summary, confirm, change, and a handle to `useAskStream` for the search; the last 6 user messages feed the search `history`.
- `ask-bot.tsx`: the orb; state comes from the chat (thinking), speech input (listening) and voice output (speaking).
- `voice.ts`: `Voice = { speak(text, language): Promise<void>; cancel(): void; available: boolean }` with a browser implementation.
- `use-speech-input.ts`: continuous mode with a silence timer and an `onFinal` that fires once per utterance.
- The overlay becomes a chat thread: bot messages on the left with quick replies under the latest one, visitor messages on the right, the confirmation card, and search results rendered as a bot message (chips, best match, cards, reply). The composer stays at the bottom.

## Failure handling

| Failure | Behaviour |
|---|---|
| DeepSeek slow (> 6 s) or erroring on a chat turn | Kiwi says it will search with what it has and shows the confirmation card built from the user messages. |
| Chat quota exhausted | Same confirmation fallback; search quota still applies. |
| Speech synthesis missing | Text only, no auto-listen loop. |
| Speech recognition missing or denied | Text input only, with the existing message. |

## Testing

Unit: chat schema, forced-ready rule, fallback search text, voice picker, speech silence timer, chat reducer. Route: happy path, ready, forced on turn 6, degrade at 80 %, quota errors, invalid input, DeepSeek failure. Components: thread rendering, quick reply sends, confirm triggers search, change continues chat, bot states, mute toggle. E2E: a mocked two-turn conversation then search on three viewports. The migration is exercised in PGlite before it is applied.
