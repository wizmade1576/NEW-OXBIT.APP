export interface MarketListSkeletonProps {
  items?: number
}

export default function MarketListSkeleton({ items = 6 }: MarketListSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="rounded bg-muted h-4 w-20" />
            <div className="rounded bg-muted h-4 w-12" />
          </div>
          <div className="rounded bg-muted h-6 w-24 mb-2" />
          <div className="rounded bg-muted h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

