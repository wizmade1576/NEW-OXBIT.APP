import * as React from 'react'

type Variant = 'default' | 'secondary' | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'text-foreground border border-border',
}

export default function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        variantClasses[variant] +
        (className ? ' ' + className : '')
      }
      {...props}
    />
  )
}

