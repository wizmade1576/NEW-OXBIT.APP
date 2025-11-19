export interface NewsListSkeletonProps {
  items?: number
}

export default function NewsListSkeleton({ items = 5 }: NewsListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="rounded-md bg-muted h-4 w-24 mb-2" />
          <div className="rounded-md bg-muted h-5 w-3/4 mb-2" />
          <div className="rounded-md bg-muted h-4 w-5/6" />
        </div>
      ))}
    </div>
  )
}

