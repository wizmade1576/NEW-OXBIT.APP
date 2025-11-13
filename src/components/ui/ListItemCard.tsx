import * as React from 'react'
import Badge from './Badge'

export interface ListItemCardProps {
  title: string
  description?: string
  metaLeft?: string
  metaRight?: string
  badges?: string[]
  rightSlot?: React.ReactNode
  onClick?: () => void
}

export default function ListItemCard({
  title,
  description,
  metaLeft,
  metaRight,
  badges,
  rightSlot,
  onClick,
}: ListItemCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          {badges?.slice(0, 3).map((b, i) => (
            <Badge key={i} variant="secondary" className="shrink-0">
              {b}
            </Badge>
          ))}
        </div>
        {description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {metaLeft ? <span>{metaLeft}</span> : null}
          {metaRight ? <span className="ml-auto hidden sm:inline">{metaRight}</span> : null}
        </div>
      </div>
      {rightSlot ? (
        <div className="shrink-0 text-right text-sm text-muted-foreground">{rightSlot}</div>
      ) : null}
    </div>
  )
}

