import type { ReactNode } from 'react'
import { AlertTriangle, PackageSearch, RefreshCw } from 'lucide-react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div
      role="status"
      className="rounded-3xl border border-gray-100 bg-white py-16 text-center shadow-sm sm:py-24"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 sm:h-20 sm:w-20">
        {icon ?? <PackageSearch className="h-8 w-8 text-gray-400 sm:h-10 sm:w-10" />}
      </div>
      <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
      {description && (
        <p className="mx-auto max-w-md px-4 text-sm text-gray-500 sm:text-base">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description = 'حدث خطأ أثناء الاتصال. تحقّق من الشبكة ثم أعد المحاولة.',
  onRetry,
  isRetrying,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  isRetrying?: boolean
}) {
  return (
    <div
      role="alert"
      className="rounded-3xl border border-red-100 bg-red-50/40 py-12 text-center sm:py-16"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="mb-2 text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
      <p className="mx-auto max-w-md px-4 text-sm text-gray-600">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="جارٍ تحميل المنتجات"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="mb-3 aspect-square rounded-xl bg-gray-100" />
          <div className="h-4 w-3/4 rounded bg-gray-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
          <div className="mt-3 flex items-center justify-between">
            <div className="h-4 w-16 rounded bg-gray-100" />
            <div className="h-5 w-14 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
      <span className="sr-only">جارٍ تحميل المنتجات…</span>
    </div>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="جارٍ التحميل" className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center justify-between rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-gray-100" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
          <div className="h-6 w-20 rounded-full bg-gray-100" />
        </div>
      ))}
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  )
}
