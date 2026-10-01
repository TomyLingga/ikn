// Skeleton while the portal catalog (server-rendered product list) loads.
export default function CustomerCatalogLoading() {
  return (
    <div className="shop" aria-busy="true" aria-live="polite">
      <span className="shop-skel shop-skel-hero" />
      <span className="shop-skel shop-skel-bar" />
      <div className="pgrid">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="shop-skel shop-skel-card" />
        ))}
      </div>
    </div>
  );
}
