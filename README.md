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

## Deployment

KiwiCue is deployed from this repository to the Vercel project named `kiwicue`.

1. Link a clean checkout with `vercel link --yes --project kiwicue`.
2. Add `TICKETMASTER_API_KEY` to the Production environment with `vercel env add TICKETMASTER_API_KEY production --sensitive`. Enter the value only in the protected prompt.
3. Publish the verified commit with `vercel deploy --prod --yes`.

Keep `TICKETMASTER_API_KEY` marked **Sensitive** and server-only. Never put its value in Git, a command argument, a `NEXT_PUBLIC_` variable, or deployment logs.

The root static files remain in place so the existing GitHub Pages company site stays available while the full-stack application is developed.
