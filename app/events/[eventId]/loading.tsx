import { PortalHeader } from "../../../components/portal-header";

export default function EventDetailLoading() {
  return (
    <main className="event-detail-page">
      <PortalHeader skipTarget="event-detail" currentPage="events" />
      <section id="event-detail" className="event-state event-loading" role="status" aria-busy="true">
        <p>Loading event details</p>
        <div className="event-detail-loading-skeleton" aria-hidden="true">
          <span className="event-detail-skeleton-title" />
          <span className="event-detail-skeleton-line" />
          <span className="event-detail-skeleton-actions" />
          <span className="event-detail-skeleton-media" />
        </div>
      </section>
    </main>
  );
}
