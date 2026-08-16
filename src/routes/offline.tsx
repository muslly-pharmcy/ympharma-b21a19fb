import { createFileRoute, Link } from '@tanstack/react-router'
import { WifiOff, ShoppingCart, Receipt, Home, RefreshCw } from 'lucide-react'
import almoslyLogo from '@/assets/almosly-logo-optimized.webp'

export const Route = createFileRoute('/offline')({
  head: () => ({
    meta: [
      { title: 'وضع عدم الاتصال — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: OfflinePage,
})

function OfflinePage() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#D9EEEB] via-white to-[#E8F5F3] p-6 text-center"
    >
      <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />

      <div className="relative w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img
            src={almoslyLogo}
            alt="صيدلية المصلي"
            className="h-24 w-24 object-contain md:h-28 md:w-28"
          />
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium text-amber-800">
            <WifiOff className="h-4 w-4" />
            لا يوجد اتصال بالإنترنت
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            أنت الآن دون اتصال
          </h1>
          <p className="text-sm text-gray-600 md:text-base">
            لا تقلق — يمكنك الاستمرار في استخدام أجزاء من التطبيق باستخدام
            آخر بيانات محفوظة على جهازك. سنعيد المزامنة تلقائيًا عند عودة الإنترنت.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-primary/20 bg-white/80 p-4 backdrop-blur md:grid-cols-2">
          <OfflineTile
            to="/cart"
            icon={<ShoppingCart className="h-5 w-5" />}
            title="سلة التسوق"
            hint="عرض وتعديل المنتجات المضافة"
          />
          <OfflineTile
            to="/orders"
            icon={<Receipt className="h-5 w-5" />}
            title="طلباتي السابقة"
            hint="آخر حالة تم تحميلها"
          />
          <OfflineTile
            to="/store"
            icon={<ShoppingCart className="h-5 w-5" />}
            title="متجر الأدوية"
            hint="تصفح آخر المنتجات المخزنة"
          />
          <OfflineTile
            to="/"
            icon={<Home className="h-5 w-5" />}
            title="الرئيسية"
            hint="واجهة الترحيب"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </button>

        <p className="text-xs text-gray-500">
          الميزات التي تحتاج تحديثًا فوريًا (تأكيد طلب جديد، دفع، رفع إيصال) ستعمل
          فور عودة الإنترنت.
        </p>
      </div>
    </div>
  )
}

function OfflineTile({
  to,
  icon,
  title,
  hint,
}: {
  to: string
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-transparent bg-primary/5 p-3 text-right transition hover:border-primary/30 hover:bg-primary/10"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-600">{hint}</span>
      </span>
    </Link>
  )
}
