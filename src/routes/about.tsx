import { createFileRoute, Link } from '@tanstack/react-router'
import { Pill, Stethoscope, Truck, ShieldCheck, Clock, Sparkles } from 'lucide-react'
import { PHARMACY } from '@/shared/branding'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: `من نحن — ${PHARMACY.nameAr}` },
      { name: 'description', content: `تعرّف على ${PHARMACY.nameAr}: قصتنا، خدماتنا الدوائية، وساعات العمل في عدن.` },
      { property: 'og:title', content: `من نحن — ${PHARMACY.nameAr}` },
      { property: 'og:description', content: PHARMACY.description },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://muslly.com/about' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/about' }],
  }),
  component: AboutPage,
})

const SERVICES = [
  { icon: Pill, title: 'مراجعة الوصفات', desc: 'ارفع الوصفة لمراجعتها والتأكد من توفر الأصناف قبل الصرف.' },
  { icon: Stethoscope, title: 'إرشاد دوائي', desc: 'قنوات تواصل مع الصيدلية ومساعد معلومات دوائية مساند.' },
  { icon: Truck, title: 'توصيل الأدوية', desc: 'يُحدد موعد التوصيل داخل عدن حسب المنطقة وتوفر الطلب.' },
  { icon: ShieldCheck, title: 'سلامة الطلب', desc: 'مراجعة الصنف والعبوة والصلاحية قبل التسليم.' },
]

function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 space-y-12">
      <section className="text-center space-y-4">
        <img src={PHARMACY.logo} alt={PHARMACY.nameAr} className="w-24 h-24 mx-auto rounded-2xl bg-primary/5 p-3" />
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
          {PHARMACY.nameAr} — رعاية دوائية موثوقة وتوصيل أدوية في عدن
        </h1>
        <p className="text-gray-500">{PHARMACY.nameEn} — {PHARMACY.tagline}</p>
      </section>

      <section className="prose prose-lg max-w-none text-right">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">قصتنا</h2>
        <p className="text-gray-700 leading-loose">
          انطلقت {PHARMACY.nameAr} في قلب عدن لخدمة المرضى والعائلات بأعلى معايير الجودة الدوائية.
          نجمع بين خبرة الصيادلة المحليين وأحدث تقنيات الذكاء الصناعي لتقديم رعاية دوائية شاملة،
          آمنة، وفي متناول الجميع — من صرف الوصفات إلى المتابعة والتوصيل.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">خدماتنا</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-2xl border border-gray-200 bg-white hover:shadow-md transition">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />ساعات العمل</h3>
          <ul className="space-y-2 text-gray-700">
            {PHARMACY.hoursAr.map((h) => (
              <li key={h.day} className="flex justify-between border-b border-primary/10 pb-2">
                <span className="font-medium">{h.day}</span>
                <span className="text-gray-600">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 rounded-2xl bg-gold/5 border border-gold/10">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-gold" />رعاية ذكية</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            استخدم المساعد للحصول على معلومات دوائية عامة، أو تصفّح الدليل الطبي للعثور على مقدم رعاية مناسب.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/ai-chat" className="px-4 py-2 rounded-xl bg-primary text-white text-sm">المحادثة الذكية</Link>
            <Link to="/contact" className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-sm">تواصل معنا</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
