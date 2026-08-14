import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import {
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  ShoppingBag,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { listCart } from '@/lib/cart.functions'
import {
  listPaymentMethods,
  listProductImageUrls,
  listShippingZones,
  placeOrder,
} from '@/lib/storefront.functions'
import {
  openWhatsAppOrder,
  type WhatsAppOrderLine,
} from '@/lib/whatsapp/order-message'


export const Route = createFileRoute('/_authenticated/checkout')({
  head: () => ({
    meta: [
      { title: 'إتمام الطلب — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: CheckoutPage,
})

function CheckoutPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: cart = [], isLoading: cartLoading } = useQuery({
    queryKey: ['cart', 'items'],
    queryFn: () => listCart(),
  })
  const { data: zones = [] } = useQuery({
    queryKey: ['storefront', 'shipping-zones'],
    queryFn: () => listShippingZones(),
    staleTime: 5 * 60_000,
  })
  const { data: methods = [] } = useQuery({
    queryKey: ['storefront', 'payment-methods'],
    queryFn: () => listPaymentMethods(),
    staleTime: 5 * 60_000,
  })

  const [zoneId, setZoneId] = useState<string>('')
  const [methodCode, setMethodCode] = useState<string>('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const [waFallbackUrl, setWaFallbackUrl] = useState<string | null>(null)

  const imagesFn = useServerFn(listProductImageUrls)

  async function dispatchToWhatsApp(orderRef: string): Promise<void> {
    const currentZone = zones.find((z) => z.id === zoneId)
    const currentMethod = methods.find((m) => m.code === methodCode)

    const lines: WhatsAppOrderLine[] = await Promise.all(
      cart.map(async (row) => {
        let imageUrl: string | null = null
        try {
          const media = await imagesFn({ data: { productId: row.product_id } })
          imageUrl = media[0]?.url ?? null
        } catch {
          imageUrl = null
        }
        return {
          name: row.product?.name_ar ?? 'صنف',
          quantity: row.quantity,
          unitPrice: Number(
            (row.product as unknown as { sbdma_official_price?: number | null } | null)
              ?.sbdma_official_price ?? 0,
          ),
          imageUrl,
        }
      }),
    )

    const { url, opened } = openWhatsAppOrder({
      orderRef,
      customerName,
      phone,
      address,
      zoneName: currentZone?.name_ar ?? null,
      paymentMethod: currentMethod?.name_ar ?? null,
      notes: notes || null,
      shippingFee: currentZone?.fee ?? 0,
      lines,
    })
    if (!opened) {
      setWaFallbackUrl(url)
      toast.info('اضغط على رابط واتساب لإرسال الطلب')
    }
  }

  const placeFn = useServerFn(placeOrder)
  const placeMut = useMutation({
    mutationFn: () =>
      placeFn({
        data: {
          shippingZoneId: zoneId,
          paymentMethodCode: methodCode,
          customerName,
          phone,
          address,
          notes: notes || null,
        },
      }),
    onSuccess: async (res) => {
      toast.success('تم إنشاء الطلب — جارٍ فتح واتساب')
      try {
        await dispatchToWhatsApp(res.id.slice(0, 8).toUpperCase())
      } catch {
        toast.error('تعذّر فتح واتساب — يمكنك متابعة الطلب من صفحة الطلبات')
      }
      void qc.invalidateQueries({ queryKey: ['cart'] })
      void qc.invalidateQueries({ queryKey: ['my-orders'] })
      void navigate({
        to: '/orders/$orderId',
        params: { orderId: res.id },
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })


  const subtotal = useMemo(
    () =>
      cart.reduce(
        (s, r) =>
          s +
          Number(
            (r.product as unknown as { sbdma_official_price?: number | null } | null)
              ?.sbdma_official_price ?? 0,
          ) *
            r.quantity,
        0,
      ),
    [cart],
  )
  const zone = zones.find((z) => z.id === zoneId)
  const shipping = zone?.fee ?? 0
  const total = subtotal + shipping
  const method = methods.find((m) => m.code === methodCode)

  const deliveryEnabled = isFlagEnabled('enable_delivery_orders')

  const canSubmit =
    deliveryEnabled &&
    !cartLoading &&
    cart.length > 0 &&
    zoneId &&
    methodCode &&
    customerName.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    address.trim().length >= 4 &&
    !placeMut.isPending


  if (!cartLoading && cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8 pt-24 text-center" dir="rtl">
        <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="mb-4 text-gray-600">السلة فارغة — أضف منتجات أولاً.</p>
        <Link
          to="/shop"
          search={{ page: 1 }}
          className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          تصفح المتجر
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8 pt-24" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">إتمام الطلب</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="بيانات المستلم" icon={MapPin}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="الاسم الكامل" required>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input"
                  placeholder="مثال: أحمد محمد"
                />
              </Field>
              <Field label="رقم الجوال" required>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input"
                  placeholder="7XXXXXXXX"
                  inputMode="tel"
                />
              </Field>
              <Field label="منطقة الشحن" required>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="input"
                >
                  <option value="">اختر المنطقة…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name_ar} — {Number(z.fee).toLocaleString('ar-EG')} {z.currency}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="الوقت المتوقع">
                <input
                  value={zone?.estimated_days ?? ''}
                  readOnly
                  className="input bg-gray-50"
                  placeholder="—"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="العنوان بالتفصيل" required>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input min-h-[80px]"
                    placeholder="الحي، الشارع، أقرب معلم، رقم المبنى…"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="ملاحظات (اختياري)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input min-h-[60px]"
                    placeholder="أي تعليمات للتوصيل…"
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="طريقة الدفع" icon={Wallet}>
            <div className="space-y-2">
              {methods.map((m) => {
                const active = m.code === methodCode
                return (
                  <button
                    type="button"
                    key={m.code}
                    onClick={() => setMethodCode(m.code)}
                    className={`w-full rounded-xl border p-3 text-right transition ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {m.name_ar}
                        </p>
                        {m.description_ar && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {m.description_ar}
                          </p>
                        )}
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </div>
                    {active && m.instructions_ar && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-white p-2 text-xs text-gray-700">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{m.instructions_ar}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {method?.requires_receipt && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                بعد إنشاء الطلب سيُطلب منك رفع صورة إيصال التحويل.
              </p>
            )}
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title="ملخص الطلب" icon={ShoppingBag} sticky>
            <ul className="space-y-1 text-sm">
              {cart.map((r) => {
                const price = Number(
                  (r.product as unknown as { sbdma_official_price?: number | null } | null)
                    ?.sbdma_official_price ?? 0,
                )
                return (
                  <li key={r.id} className="flex justify-between gap-2 py-1">
                    <span className="truncate text-gray-700">
                      {r.product?.name_ar ?? '—'}{' '}
                      <span className="text-gray-400">×{r.quantity}</span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {(price * r.quantity).toLocaleString('ar-EG')} ر.ي
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="my-3 border-t border-gray-100" />
            <Row label="المجموع الجزئي" value={`${subtotal.toLocaleString('ar-EG')} ر.ي`} />
            <Row
              label="الشحن"
              value={
                zone ? `${shipping.toLocaleString('ar-EG')} ر.ي` : 'اختر المنطقة'
              }
            />
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm font-semibold text-gray-900">الإجمالي</span>
              <span className="text-lg font-bold text-primary">
                {total.toLocaleString('ar-EG')} ر.ي
              </span>
            </div>

            <button
              onClick={() => placeMut.mutate()}
              disabled={!canSubmit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {placeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الطلب وإرساله عبر واتساب
            </button>
            {waFallbackUrl && (
              <a
                href={waFallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block rounded-xl border border-emerald-300 bg-emerald-50 py-2 text-center text-sm font-semibold text-emerald-800"
              >
                فتح واتساب لإرسال الطلب
              </a>
            )}

            <p className="mt-2 text-center text-[11px] text-gray-500">
              بالضغط أنت توافق على شروط الشراء وسياسة الإرجاع.
            </p>
          </Card>
        </div>
      </div>

      <style>{`
        .input { width:100%; border:1px solid rgb(229 231 235); background:white; border-radius:0.75rem; padding:0.5rem 0.75rem; font-size:0.875rem; outline:none; }
        .input:focus { border-color: hsl(var(--primary, 175 100% 18%)); }
      `}</style>
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  sticky,
  children,
}: {
  title: string
  icon: typeof MapPin
  sticky?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${
        sticky ? 'lg:sticky lg:top-24' : ''
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
