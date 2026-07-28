# KiwiCue

Auckland events, sorted. KiwiCue is a bilingual event-discovery project for helping people find concerts, theatre, markets, festivals and community events before they miss them.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Put your Ticketmaster Consumer Key after `TICKETMASTER_API_KEY=` in `.env.local`.
4. Start the local site with `npm run dev`.

Never put the key in a variable beginning with `NEXT_PUBLIC_`, and never commit `.env.local`.

## Checks

- `npm test`
- `npm run lint`
- `npm run build`

The root static files remain in place so the existing GitHub Pages company site stays available while the full-stack application is developed.
