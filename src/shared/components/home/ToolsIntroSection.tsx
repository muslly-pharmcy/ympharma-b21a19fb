import { Link } from '@tanstack/react-router'
import { ScanLine, MessageCircle, Search, ShoppingBag, Pill, HeartPulse } from 'lucide-react'

// Customer-facing "How to use the site" section — surfaces the main tools.
const tools = [
  {
    to: '/vision-lab',
    icon: ScanLine,
    title: 'مسح الوصفة الطبية',
    desc: 'صوّر وصفتك ونستخرج الأدوية والتعليمات تلقائياً.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    to: '/ai-chat',
    icon: MessageCircle,
    title: 'استشارة ذكية 24/7',
    desc: 'اسأل مساعدنا الذكي عن أي سؤال صحي أو دوائي.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    to: '/search',
    icon: Search,
    title: 'بحث موحّد',
    desc: 'ابحث بالاسم أو الماركة أو الباركود عبر الكتالوج.',
    color: 'from-purple-500 to-fuchsia-500',
  },
  {
    to: '/shop',
    icon: ShoppingBag,
    title: 'متجر الأدوية',
    desc: 'أكثر من 3,000 صنف مع خيارات دفع وتوصيل.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    to: '/request',
    icon: Pill,
    title: 'اطلب دواءً / استشارة',
    desc: 'أرسل طلبك وسنتواصل خلال دقائق.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    to: '/contact',
    icon: HeartPulse,
    title: 'تواصل مباشر',
    desc: 'واتساب، هاتف، وموقع الصيدلية على الخريطة.',
    color: 'from-red-500 to-orange-500',
  },
] as const

export function ToolsIntroSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8" dir="rtl">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          أدوات صيدلية المصلي في متناول يدك
        </h2>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          تعرّف على ما يمكنك فعله في الموقع — كل ما تحتاجه لصحتك في مكان واحد.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <div
              className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.color} text-white shadow-md`}
            >
              <t.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary">
              {t.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-gray-600">{t.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
