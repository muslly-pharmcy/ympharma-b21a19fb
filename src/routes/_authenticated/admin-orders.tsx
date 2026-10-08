import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { Loader2, ShoppingBag, ShieldAlert, MessageCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import {
  listAllOrders,
  updateOrderStatus,
  isCurrentUserAdmin,
  type AdminOrderRow,
} from '@/lib/admin-orders.functions'

export const Route = createFileRoute('/_authenticated/admin-orders')({
  head: () => ({
    meta: [
      { title: 'إدارة الطلبات — MUSLLY AI OS' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AdminOrdersPage,
})

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.length === 9) d = '967' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
const STATUS_AR: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
}
const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

function AdminOrdersPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [view, setView] = useState<'orders' | 'customers'>('orders')

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['is-admin'],
    queryFn: () => isCurrentUserAdmin(),
  })

  const listFn = useServerFn(listAllOrders)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-orders', filter],
    queryFn: () =>
      listFn({ data: filter === 'all' ? {} : { status: filter } }),
    enabled: !!isAdmin,
  })

  const updateFn = useServerFn(updateOrderStatus)
  const updateMut = useMutation({
    mutationFn: (vars: { orderId: string; status: (typeof STATUSES)[number] }) =>
      updateFn({ data: vars }),
    onSuccess: (r: { notified?: boolean }) => {
      toast.success(r?.notified ? 'تم تحديث الحالة وإبلاغ العميل عبر واتساب' : 'تم تحديث الحالة')
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const totals = useMemo(() => {
    const t = { count: orders.length, sum: 0 }
    orders.forEach((o: AdminOrderRow) => (t.sum += Number(o.total || 0)))
    return t
  }, [orders])

  const customers = useMemo(() => {
    const m = new Map<string, { name: string; phone: string; count: number; sum: number; last: string }>()
    orders.forEach((o: AdminOrderRow) => {
      if (!o.customer_phone) return
      const k = o.customer_phone.replace(/\D/g, '').slice(-9)
      const c = m.get(k) ?? { name: o.customer_name || '—', phone: o.customer_phone, count: 0, sum: 0, last: o.created_at }
      c.count += 1
      c.sum += Number(o.total || 0)
      if (o.created_at > c.last) c.last = o.created_at
      m.set(k, c)
    })
    return [...m.values()].sort((a, b) => b.last.localeCompare(a.last))
  }, [orders])

  if (adminLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center" dir="rtl">
        <ShieldAlert className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">صلاحيات غير كافية</h1>
        <p className="text-gray-600">تحتاج إلى صلاحية «admin» للوصول إلى إدارة الطلبات.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">إدارة الطلبات</h1>
            <p className="text-sm text-gray-500">
              {totals.count} طلب · إجمالي {totals.sum.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView(view === 'orders' ? 'customers' : 'orders')}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary flex items-center gap-1"
          >
            <Users className="w-4 h-4" />
            {view === 'orders' ? `أرقام العملاء (${customers.length})` : 'عرض الطلبات'}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            الكل
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                filter === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {STATUS_AR[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : view === 'customers' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="text-right px-4 py-3">العميل</th>
                <th className="text-right px-4 py-3">الهاتف</th>
                <th className="text-right px-4 py-3">عدد الطلبات</th>
                <th className="text-right px-4 py-3">إجمالي المشتريات</th>
                <th className="text-right px-4 py-3">آخر طلب</th>
                <th className="text-right px-4 py-3">تواصل</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const href = waLink(c.phone, `مرحباً ${c.name}، معك صيدلية المصلي.`)
                return (
                  <tr key={c.phone} className="border-t border-gray-100">
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3" dir="ltr">
                      <a href={`tel:${c.phone}`} className="text-primary">{c.phone}</a>
                    </td>
                    <td className="px-4 py-3">{c.count}</td>
                    <td className="px-4 py-3 font-bold text-primary">{c.sum.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.last).toLocaleDateString('ar-YE')}</td>
                    <td className="px-4 py-3">
                      {href && (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white text-xs">
                          <MessageCircle className="w-3.5 h-3.5" /> واتساب
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
          لا توجد طلبات مطابقة للفلتر الحالي.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="text-right px-4 py-3">رقم الطلب</th>
                <th className="text-right px-4 py-3">العميل</th>
                <th className="text-right px-4 py-3">الهاتف</th>
                <th className="text-right px-4 py-3">الإجمالي</th>
                <th className="text-right px-4 py-3">الدفع</th>
                <th className="text-right px-4 py-3">الحالة</th>
                <th className="text-right px-4 py-3">التاريخ</th>
                <th className="text-right px-4 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: AdminOrderRow) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{o.id}</td>
                  <td className="px-4 py-3">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-2" dir="ltr">
                      <span>{o.customer_phone || '—'}</span>
                      {waLink(o.customer_phone, `مرحباً ${o.customer_name ?? ''}، بخصوص طلبك رقم ${o.id} من صيدلية المصلي.`) && (
                        <a
                          href={waLink(o.customer_phone, `مرحباً ${o.customer_name ?? ''}، بخصوص طلبك رقم ${o.id} من صيدلية المصلي.`)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="تواصل عبر واتساب"
                          className="p-1 rounded-md bg-green-600 text-white"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-primary">
                    {Number(o.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {o.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLOR[o.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_AR[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(o.created_at).toLocaleString('ar-YE')}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      disabled={updateMut.isPending}
                      onChange={(e) =>
                        updateMut.mutate({
                          orderId: o.id,
                          status: e.target.value as (typeof STATUSES)[number],
                        })
                      }
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_AR[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
