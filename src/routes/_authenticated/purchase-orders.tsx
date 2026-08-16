import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { listPurchaseOrders } from '@/lib/purchasing.functions'
import { FileText } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/purchase-orders')({
  head: () => ({
    meta: [
      { title: 'أوامر الشراء — MUSLLY AI OS' },
      { name: 'description', content: 'إدارة أوامر الشراء ودورة حياتها.' },
    ],
  }),
  component: PurchaseOrdersPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسوّدة',
  submitted: 'مُرسلة',
  approved: 'معتمدة',
  received: 'مُستلمة',
  cancelled: 'ملغاة',
}

function PurchaseOrdersPage() {
  const { data: orders = [] } = useQuery({
    queryKey: ['purchasing', 'list'],
    queryFn: () => listPurchaseOrders(),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">أوامر الشراء</h1>
      </div>

      {orders.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا توجد أوامر شراء بعد</p>
          <p className="max-w-md text-sm text-muted-foreground">
            أوامر الشراء محمية بسياسات RLS على مستوى المؤسسة. سجّل الدخول
            كعضو في المؤسسة لعرض وإنشاء الأوامر.
          </p>
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-gray-100 rounded-2xl">
          {orders.map((po) => (
            <li key={po.id} className="p-4">
              <Link
                to="/purchase-orders/$id"
                params={{ id: po.id }}
                className="flex items-center gap-3"
              >
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold">{po.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(po.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {STATUS_LABEL[po.status] ?? po.status}
                </span>
                <span className="text-sm font-mono">
                  {Number(po.total_amount).toLocaleString('ar-EG')} {po.currency}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
