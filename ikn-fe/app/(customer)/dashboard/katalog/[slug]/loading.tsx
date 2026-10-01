// Skeleton while a portal product detail loads (gallery, buy box, details).
export default function CustomerProductLoading() {
  return (
    <div className="pdp" aria-busy="true" aria-live="polite">
      <span className="pdp-gallery shop-skel" style={{ aspectRatio: '1 / 1' }} />
      <span className="pdp-aside shop-skel" style={{ minHeight: 420 }} />
      <span className="pdp-content shop-skel" style={{ minHeight: 260 }} />
    </div>
  );
}
