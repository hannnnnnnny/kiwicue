"use client";

import { PortalHeader } from "../../../components/portal-header";

export default function EventDetailError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="event-detail-page">
      <PortalHeader skipTarget="event-detail" currentPage="events" />
      <section id="event-detail" className="event-state event-error" role="alert">
        <span className="state-code" aria-hidden="true">DETAIL / RETRY</span>
        <h1>Event details are temporarily unavailable</h1>
        <p>The official event feed could not be refreshed. Try again in a moment.</p>
        <button type="button" onClick={reset}>Retry event details</button>
      </section>
    </main>
  );
}
