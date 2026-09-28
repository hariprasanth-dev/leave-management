export function Skeleton({ width = '100%', height = '1rem', radius = '0.45rem', className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Loading content">
      <Skeleton height="2rem" width="40%" />
      <Skeleton height="1rem" width="55%" />
      <div className="page-skeleton-grid">
        <Skeleton height="6rem" />
        <Skeleton height="6rem" />
        <Skeleton height="6rem" />
      </div>
      <Skeleton height="10rem" />
    </div>
  )
}
