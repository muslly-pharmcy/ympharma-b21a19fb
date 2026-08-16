import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, ArrowLeft } from 'lucide-react'
import { listMyOrders } from '@/lib/storefront.functions'
import { EmptyState, ErrorState, ListSkeleton } from '@/shared/components/StateViews'

export const Route = createFileRoute('/_authenticated/orders')({
  head: () => ({
    meta: [
      { title: 'طلباتي — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: MyOrdersPage,
})

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المعالجة', color: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'مؤكد', color: 'bg-blue-100 text-blue-700' },
  processing: { label: 'قيد التجهيز', color: 'bg-blue-100 text-blue-700' },
  shipped: { label: 'تم الشحن', color: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'تم التسليم', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'ملغى', color: 'bg-red-100 text-red-700' },
}

function MyOrdersPage() {
  const { data: orders = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => listMyOrders(),
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8 pt-24" dir="rtl">
      <header className="flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">طلباتي</h1>
      </header>

      {isError ? (
        <ErrorState
          onRetry={() => void refetch()}
          isRetrying={isRefetching}
          description="تعذّر جلب قائمة الطلبات. تحقّق من الاتصال ثم أعد المحاولة."
        />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8 text-gray-400 sm:h-10 sm:w-10" />}
          title="لا توجد طلبات بعد"
          description="عند إتمام أوّل طلب سيظهر هنا مع حالته وتفاصيله."
          action={
            <Link
              to="/shop"
              search={{ page: 1 }}
              className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              ابدأ التسوّق
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const s = statusLabels[o.status] ?? {
              label: o.status,
              color: 'bg-gray-100 text-gray-700',
            }
            return (
              <li key={o.id}>
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      {o.id}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(o.created_at).toLocaleString('ar-EG')} ·{' '}
                      {o.items.length} صنف
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${s.color}`}>
                      {s.label}
                    </span>
                    <span className="font-bold text-primary">
                      {Number(o.total).toLocaleString('ar-EG')} ر.ي
                    </span>
                    <ArrowLeft className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
