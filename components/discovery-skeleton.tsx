export function DiscoverySkeleton() {
  return <div className="discovery-skeleton" aria-hidden="true">
    <div className="discovery-skeleton-chips">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
    <div className="discovery-skeleton-feature" />
    <div className="discovery-skeleton-rows">{Array.from({ length: 2 }, (_, index) => <div key={index}><span /><span /></div>)}</div>
  </div>;
}
