export interface InfiniteListSkeletonProps {
  items?: number
}

export default function InfiniteListSkeleton({ items = 6 }: InfiniteListSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, idx) => (
        <div key={idx} className="animate-pulse space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
        </div>
      ))}
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-transparent" />
    </div>
  )
}

