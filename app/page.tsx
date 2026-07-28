import Link from "next/link";

const signals = [
  { label: "Concerts", note: "Tours, gigs and live music" },
  { label: "Theatre", note: "Plays, comedy and performance" },
  { label: "Markets", note: "Food, makers and weekend finds" },
  { label: "Festivals", note: "Culture, community and city life" },
];

export default function HomePage() {
  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="KiwiCue home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>KiwiCue</span>
        </Link>
        <span className="pilot-badge"><i aria-hidden="true" /> Auckland pilot</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">A clearer signal for what is happening next</p>
          <h1 id="hero-title">Auckland events, before you miss them</h1>
          <p className="hero-intro">
            One timely, well-sorted view of concerts, theatre, markets, festivals and local events—without
            hoping an algorithm shows you the post before it is too late.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/events">Explore Auckland events <span aria-hidden="true">↗</span></Link>
            <span className="action-note">Live event discovery is being connected now.</span>
          </div>
        </div>

        <aside className="signal-card" aria-label="KiwiCue coverage">
          <div className="signal-card-top">
            <span>AKL — NEXT 30 DAYS</span>
            <span className="live-label">LIVE SOON</span>
          </div>
          <div className="signal-list">
            {signals.map((signal, index) => (
              <div className="signal-row" key={signal.label}>
                <span className="signal-number">0{index + 1}</span>
                <div><strong>{signal.label}</strong><small>{signal.note}</small></div>
                <span aria-hidden="true">→</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="promise" aria-labelledby="promise-title">
        <p className="eyebrow">Why KiwiCue</p>
        <h2 id="promise-title">Sorted for timing, not engagement.</h2>
        <div className="promise-grid">
          <article><span>01</span><h3>Useful dates first</h3><p>See what is coming up while there is still time to plan, book and go.</p></article>
          <article><span>02</span><h3>Auckland in one view</h3><p>Spend less time checking scattered posts, ticket sites and community pages.</p></article>
          <article><span>03</span><h3>Clear source links</h3><p>Open the official event or ticket page when you are ready for the details.</p></article>
        </div>
      </section>

      <footer>
        <span>KiwiCue / 纽村小报</span>
        <span>Independent Auckland event discovery</span>
      </footer>
    </main>
  );
}
