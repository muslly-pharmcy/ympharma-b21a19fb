import type { HTMLAttributes } from 'react'

export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted/60 ${className}`}
      {...rest}
    />
  )
}

export function RouteSkeleton({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="space-y-6 p-6" role="status" aria-live="polite" aria-label={label}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}
