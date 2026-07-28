import type { Metadata } from "next";
import Link from "next/link";
import { EventExplorer } from "./event-explorer";

export const metadata: Metadata = {
  title: "Auckland events — KiwiCue",
  description: "A date-sorted view of upcoming Auckland concerts, theatre, festivals and live events.",
};

export default function EventsPage() {
  return (
    <main className="events-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Back to KiwiCue home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>KiwiCue</span>
        </Link>
        <Link className="home-return" href="/">Home <span aria-hidden="true">↖</span></Link>
      </header>

      <section className="events-masthead" aria-labelledby="events-title">
        <div className="events-masthead-copy">
          <p className="eyebrow">Auckland event signal / Live discovery</p>
          <h1 id="events-title">What’s on, <em>before it’s gone</em></h1>
          <p>
            Upcoming concerts, theatre, festivals and live events in one chronological feed—so the useful
            date reaches you before the recommendation does.
          </p>
        </div>
        <aside className="events-scope" aria-label="Current event search scope">
          <div><span>Location</span><strong>Auckland</strong></div>
          <div><span>Window</span><strong>Next 30 days</strong></div>
          <div><span>Order</span><strong>Soonest first</strong></div>
        </aside>
      </section>

      <div className="events-ticker" aria-label="Event feed status">
        <span>Auckland · Next 30 days</span>
        <span><i aria-hidden="true" /> Live source check</span>
        <span>24 results per scan</span>
      </div>

      <EventExplorer />

      <footer>
        <span>KiwiCue / 纽村小报</span>
        <span>Find it in time. Check details at the source.</span>
      </footer>
    </main>
  );
}
