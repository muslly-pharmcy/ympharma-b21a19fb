import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getPurchaseOrder } from '@/lib/purchasing.functions'
import { usePurchaseOrderMutations } from '@/hooks/mutations/inventory'
import { ArrowRight } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/purchase-orders/$id')({
  head: () => ({
    meta: [{ title: 'تفاصيل أمر الشراء — MUSLLY AI OS' }],
  }),
  component: PODetail,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function PODetail() {
  const params = Route.useParams()
  const { data } = useQuery({
    queryKey: ['purchasing', 'detail', params.id],
    queryFn: () => getPurchaseOrder({ data: { id: params.id } }),
  })
  const m = usePurchaseOrderMutations()

  if (!data) return <div className="p-8 text-center">جاري التحميل...</div>
  const { po, lines } = data

  const call = (fn: (arg: { data: { id: string } }) => Promise<unknown>) =>
    fn({ data: { id: po.id } })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        to="/purchase-orders"
        className="flex items-center gap-2 text-sm text-primary"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للقائمة
      </Link>
      <header className="glass-panel space-y-2 rounded-2xl p-6">
        <h1 className="text-2xl font-bold">{po.code}</h1>
        <p className="text-sm text-muted-foreground">
          الحالة: {po.status} · العملة: {po.currency} · الإجمالي:{' '}
          {Number(po.total_amount).toLocaleString('ar-EG')}
        </p>
        <div className="flex flex-wrap gap-2 pt-3">
          {po.status === 'draft' && (
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
              onClick={() => call(m.submit.mutateAsync)}
              disabled={m.submit.isPending}
            >
              إرسال للاعتماد
            </button>
          )}
          {po.status === 'submitted' && (
            <button
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
              onClick={() => call(m.approve.mutateAsync)}
              disabled={m.approve.isPending}
            >
              اعتماد
            </button>
          )}
          {po.status === 'approved' && (
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white"
              onClick={() => call(m.receive.mutateAsync)}
              disabled={m.receive.isPending}
            >
              استلام المخزون
            </button>
          )}
          {po.status !== 'received' && po.status !== 'cancelled' && (
            <button
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm"
              onClick={() => call(m.cancel.mutateAsync)}
              disabled={m.cancel.isPending}
            >
              إلغاء
            </button>
          )}
        </div>
      </header>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-3 text-lg font-semibold">البنود</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="py-2">#</th>
              <th>المنتج</th>
              <th>الكمية</th>
              <th>المستلم</th>
              <th>سعر الوحدة</th>
              <th>الدُفعة</th>
              <th>الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-2">{l.line_no}</td>
                <td className="font-mono text-xs">{l.product_id.slice(0, 8)}…</td>
                <td>{l.qty_ordered}</td>
                <td>{l.qty_received}</td>
                <td>{l.unit_cost}</td>
                <td>{l.batch_no ?? '—'}</td>
                <td>{l.expiry_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
