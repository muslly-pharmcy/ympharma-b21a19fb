import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { getMyOrder, setOrderReceipt } from '@/lib/storefront.functions'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  head: () => ({
    meta: [
      { title: 'تفاصيل الطلب — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: OrderDetailPage,
})

const statusMap: Record<string, string> = {
  pending: 'قيد المعالجة',
  confirmed: 'مؤكد',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغى',
}
const paymentStatusMap: Record<string, string> = {
  pending: 'بانتظار الدفع',
  awaiting_receipt: 'بانتظار رفع الإيصال',
  submitted: 'قيد المراجعة',
  paid: 'مدفوع',
  refunded: 'مسترد',
}

function OrderDetailPage() {
  const { orderId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', orderId],
    queryFn: () => getMyOrder({ data: { id: orderId } }),
    staleTime: 60_000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnReconnect: true,
    placeholderData: (prev) => prev,
  })

  const setReceiptFn = useServerFn(setOrderReceipt)
  const setReceipt = useMutation({
    mutationFn: (path: string) =>
      setReceiptFn({ data: { orderId, receiptPath: path } }),
    onSuccess: () => {
      toast.success('تم رفع الإيصال — بانتظار المراجعة')
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function onUpload(file: File) {
    setUploading(true)
    try {
      const { data: sess } = await supabase.auth.getUser()
      const uid = sess.user?.id
      if (!uid) throw new Error('غير مسجل الدخول')
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${uid}/${orderId}-${Date.now()}.${ext}`
      const up = await supabase.storage
        .from('payment-receipts')
        .upload(path, file, { upsert: true })
      if (up.error) throw new Error(up.error.message)
      await setReceipt.mutateAsync(path)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  if (isLoading) return <div className="p-8 pt-24 text-center">جاري التحميل…</div>
  if (!data) {
    return (
      <div className="p-8 pt-24 text-center" dir="rtl">
        <p className="mb-4">الطلب غير موجود.</p>
        <Link to="/orders" className="text-primary underline">
          العودة إلى طلباتي
        </Link>
      </div>
    )
  }
  const { order, history } = data
  const needsReceipt =
    order.payment_status === 'awaiting_receipt' && !order.payment_receipt_path

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8 pt-24" dir="rtl">
      <button
        onClick={() => void navigate({ to: '/orders' })}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary"
      >
        <ArrowRight className="h-4 w-4" /> العودة إلى طلباتي
      </button>

      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">رقم الطلب</p>
            <p className="font-mono text-lg font-bold text-gray-900">{order.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
              {statusMap[order.status] ?? order.status}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
              {paymentStatusMap[order.payment_status] ?? order.payment_status}
            </span>
          </div>
        </div>
      </header>

      {needsReceipt && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">
            رفع إيصال الدفع
          </h2>
          <p className="mb-3 text-xs text-amber-800">
            بعد إتمام التحويل، ارفع صورة الإيصال ليتم مراجعة الطلب.
          </p>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/30 hover:bg-primary/5">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'جارٍ الرفع…' : 'اختر صورة الإيصال'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUpload(f)
              }}
            />
          </label>
        </section>
      )}
      {order.payment_receipt_path && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          تم رفع إيصال الدفع — بانتظار مراجعة الصيدلية.
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">الأصناف</h2>
        <ul className="divide-y divide-gray-100">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between py-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">{i.name_ar}</p>
                <p className="text-xs text-gray-500">
                  {[i.brand, i.strength].filter(Boolean).join(' · ') || '—'} ×{' '}
                  {i.quantity}
                </p>
              </div>
              <span className="font-semibold text-gray-900">
                {Number(i.line_total).toLocaleString('ar-EG')} ر.ي
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
          <Row label="المجموع" value={`${Number(order.subtotal ?? 0).toLocaleString('ar-EG')} ر.ي`} />
          <Row
            label="الشحن"
            value={`${Number(order.shipping_fee ?? 0).toLocaleString('ar-EG')} ر.ي`}
          />
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="font-semibold">الإجمالي</span>
            <span className="font-bold text-primary">
              {Number(order.total).toLocaleString('ar-EG')} ر.ي
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">المستلم</h2>
        <div className="space-y-1 text-sm text-gray-700">
          <p><b>الاسم:</b> {order.customer_name}</p>
          <p><b>الجوال:</b> {order.phone}</p>
          <p><b>العنوان:</b> {order.address}</p>
          {order.notes && <p><b>ملاحظات:</b> {order.notes}</p>}
        </div>
      </section>

      {history.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">سجل الحالة</h2>
          <ol className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex justify-between text-xs text-gray-600"
              >
                <span>{statusMap[h.status] ?? h.status}</span>
                <span>{new Date(h.created_at).toLocaleString('ar-EG')}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
