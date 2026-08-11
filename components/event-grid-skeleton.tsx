export function EventGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="event-grid-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="event-card-skeleton" key={index}>
          <span className="event-card-skeleton-title" />
          <span className="event-card-skeleton-line" />
          <span className="event-card-skeleton-line" />
          <span className="event-card-skeleton-media" />
        </div>
      ))}
    </div>
  );
}
