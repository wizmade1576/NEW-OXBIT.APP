import * as React from 'react'
import Button from './Button'

export interface SortOption {
  label: string
  value: string
}

export interface SortFilterBarProps {
  sortOptions: SortOption[]
  defaultSort?: string
  filters?: string[]
  onChange?: (state: { sort: string; filters: string[] }) => void
}

export default function SortFilterBar({ sortOptions, defaultSort, filters = [], onChange }: SortFilterBarProps) {
  const [sort, setSort] = React.useState(defaultSort ?? sortOptions[0]?.value ?? 'default')
  const [active, setActive] = React.useState<string[]>([])

  React.useEffect(() => {
    onChange?.({ sort, filters: active })
  }, [sort, active, onChange])

  function toggleFilter(f: string) {
    setActive((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            variant={active.includes(f) ? 'primary' : 'outline'}
            size="sm"
            onClick={() => toggleFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>
    </div>
  )
}

