import * as React from 'react'

export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm ' +
        (className ? className : '')
      }
      {...props}
    />
  )
}

export function CardHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={'flex flex-col space-y-1.5 p-4 ' + (className ? className : '')} {...props} />
}

export function CardTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={'text-lg font-semibold leading-none tracking-tight ' + (className ? className : '')} {...props} />
}

export function CardDescription({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={'text-sm text-muted-foreground ' + (className ? className : '')} {...props} />
}

export function CardContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={'p-4 pt-0 ' + (className ? className : '')} {...props} />
}

export function CardFooter({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={'flex items-center p-4 pt-0 ' + (className ? className : '')} {...props} />
}

export default Card

