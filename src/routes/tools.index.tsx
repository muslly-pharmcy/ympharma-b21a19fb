import { createFileRoute, Link } from '@tanstack/react-router'
import { Baby, Network, Stethoscope, CalendarClock, ArrowLeft, Scale } from 'lucide-react'
import { Reveal, Stagger, RevealItem } from '@/shared/components/motion/Reveal'
import { ToolsIntroSection } from '@/shared/components/home/ToolsIntroSection'


export const Route = createFileRoute('/tools/')({
  head: () => {
    const title = 'الأدوات الطبية التفاعلية — 5 أدوات مجانية من صيدلية المصلي'
    const description =
      'حاسبة جرعات الأطفال، فاحص التداخلات الدوائية، مرشد الأعراض، مخطط جدول الأدوية، وحاسبة كتلة الجسم والترطيب — خمس أدوات عربية مجانية من صيدلية المصلي في عدن.'
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://muslly.com/tools' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
      ],
      links: [{ rel: 'canonical', href: 'https://muslly.com/tools' }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: title,
            itemListElement: TOOLS.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: t.title,
              url: `https://muslly.com${t.to}`,
            })),
          }),
        },
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: TOOL_FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        },
      ],
    }
  },
  component: ToolsHub,
})


const TOOLS = [
  {
    to: '/tools/pediatric-dose' as const,
    icon: Baby,
    title: 'حاسبة جرعات الأطفال',
    desc: 'احسب الجرعة الآمنة حسب الوزن والعمر والتركيز خطوة بخطوة.',
    long: 'أدخل وزن الطفل وتركيز الشراب لتحصل على الجرعة بالمليلتر وعدد المرات اليومية، مع تنبيه عند تجاوز الحد الأقصى. مفيدة تحديداً مع خافضات الحرارة مثل الباراسيتامول.',
    accent: 'from-sky-500/20 to-cyan-400/10',
    iconClass: 'text-sky-600 bg-sky-50',
  },
  {
    to: '/tools/interactions' as const,
    icon: Network,
    title: 'فاحص التداخلات الدوائية',
    desc: 'أدخل المواد الفعالة واعرض شدة التداخل بشارات واضحة.',
    long: 'اكتب الأدوية التي تتناولها معاً ليعرض الفاحص التداخلات المحتملة مصنّفة حسب الشدة مع شرح عربي مبسّط لما يجب فعله قبل مراجعة الصيدلي.',
    accent: 'from-emerald-500/20 to-teal-400/10',
    iconClass: 'text-emerald-600 bg-emerald-50',
  },
  {
    to: '/tools/symptoms' as const,
    icon: Stethoscope,
    title: 'مرشد الأعراض',
    desc: 'أسئلة قصيرة تقودك لتوصية رعاية ذاتية أو تنبيه للطوارئ.',
    long: 'سلسلة أسئلة قصيرة تساعدك على تمييز ما يمكن التعامل معه منزلياً عمّا يحتاج زيارة طبيب أو طوارئ فوراً، مع اقتراح المنتجات المناسبة للرعاية الذاتية.',
    accent: 'from-violet-500/20 to-fuchsia-400/10',
    iconClass: 'text-violet-600 bg-violet-50',
  },
  {
    to: '/tools/schedule' as const,
    icon: CalendarClock,
    title: 'مخطط جدول الأدوية',
    desc: 'رتّب جرعاتك اليومية وصدّرها كتذكيرات في تقويمك.',
    long: 'رتّب أدويتك المزمنة على مدار اليوم بفواصل صحيحة بين الجرعات، ثم صدّر الجدول كتذكيرات إلى تقويم هاتفك حتى لا تنسى أي جرعة.',
    accent: 'from-amber-500/20 to-orange-400/10',
    iconClass: 'text-amber-600 bg-amber-50',
  },
  {
    to: '/tools/bmi' as const,
    icon: Scale,
    title: 'حاسبة كتلة الجسم والترطيب',
    desc: 'اعرف مؤشر كتلة جسمك واحتياجك اليومي من الماء فوراً.',
    long: 'احسب مؤشر كتلة الجسم وتصنيفه، إضافة إلى احتياجك اليومي التقريبي من الماء حسب الوزن — مفيدة في متابعة الوزن والسكري وضغط الدم.',
    accent: 'from-cyan-500/20 to-blue-400/10',
    iconClass: 'text-cyan-600 bg-cyan-50',
  },
]

const TOOL_FAQS = [
  {
    q: 'هل استخدام الأدوات مجاني؟',
    a: 'نعم، جميع الأدوات مجانية ولا تحتاج تسجيل دخول.',
  },
  {
    q: 'هل تغني هذه الأدوات عن الطبيب أو الصيدلي؟',
    a: 'لا. النتائج إرشادية فقط ومبنية على مراجع دوائية عامة، والقرار النهائي يعود للطبيب أو الصيدلي المختص.',
  },
  {
    q: 'هل تُحفظ بياناتي الصحية؟',
    a: 'تُحسب النتائج مباشرة أثناء الاستخدام ولا نطلب بيانات هوية لاستخدام الأدوات.',
  },
  {
    q: 'هل يمكنني طلب الدواء بعد استخدام الأداة؟',
    a: 'نعم، يمكنك تصفّح المتجر أو إرسال طلب عبر واتساب ليراجعه الصيدلي قبل الصرف والتوصيل داخل عدن.',
  },
]



function ToolsHub() {
  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-4 py-10">
      <Reveal className="mb-8 text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
          أدوات إرشادية · لا تغني عن استشارة الطبيب
        </p>
        <h1 className="text-fluid-title font-black text-gray-900">الأدوات الطبية التفاعلية</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">
          خمس أدوات عربية سريعة تساعدك على اتخاذ قرار دوائي أكثر أماناً — حساب جرعات الأطفال،
          فحص التداخلات، فرز الأعراض، تنظيم مواعيد الأدوية، وقياس كتلة الجسم — مبنية على مراجع
          دوائية وبيانات صيدلية المصلي المعتمدة في عدن.
        </p>

      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <RevealItem key={tool.to}>
            <Link
              to={tool.to}
              preload="intent"
              className="glass-card press-scale group relative flex h-full flex-col gap-3 overflow-hidden p-5"
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tool.accent} blur-2xl`}
              />
              <span
                className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${tool.iconClass}`}
              >
                <tool.icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="relative">
                <h2 className="text-base font-bold text-gray-900">{tool.title}</h2>
                <p className="mt-1 text-xs leading-6 text-gray-600">{tool.desc}</p>
                <p className="mt-2 text-xs leading-6 text-gray-500">{tool.long}</p>
              </div>

              <span className="relative mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                ابدأ الآن
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" aria-hidden />
              </span>
            </Link>
          </RevealItem>
        ))}
      </Stagger>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-gray-900">متى تستخدم هذه الأدوات؟</h2>
        <p className="text-sm leading-8 text-gray-600">
          استخدم حاسبة الجرعات قبل إعطاء شراب خافض للحرارة لطفلك، وفاحص التداخلات قبل إضافة
          دواء جديد إلى أدويتك المزمنة، ومرشد الأعراض عندما تتردد بين الرعاية المنزلية وزيارة
          الطبيب. مخطط الجدول يفيد مرضى الأمراض المزمنة الذين يتناولون أكثر من دواء يومياً،
          وحاسبة كتلة الجسم تساعد في متابعة الوزن والترطيب. النتائج إرشادية، ويمكنك دائماً
          مراجعة{' '}
          <Link to="/guides" className="font-semibold text-primary">
            الأدلة الدوائية
          </Link>{' '}
          أو التواصل مع صيدلي عبر{' '}
          <Link to="/request" className="font-semibold text-primary">
            نموذج الطلب
          </Link>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-gray-900">أسئلة شائعة</h2>
        <div className="space-y-3">
          {TOOL_FAQS.map((f) => (
            <div key={f.q} className="glass-card p-4">
              <h3 className="text-sm font-bold text-gray-900">{f.q}</h3>
              <p className="mt-1 text-sm leading-7 text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
