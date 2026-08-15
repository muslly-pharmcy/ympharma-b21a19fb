import { createFileRoute, Link } from '@tanstack/react-router'
import {
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  ShieldCheck,
  Truck,
  ArrowLeft,
} from 'lucide-react'
import { PHARMACY } from '@/shared/branding'
import { Reveal, Stagger, RevealItem } from '@/shared/components/motion/Reveal'

const CANONICAL = 'https://muslly.com/delivery/aden'
const TITLE = 'توصيل الأدوية في عدن — صيدلية المصلي | كريتر والمعلا وخورمكسر'
const DESCRIPTION =
  'توصيل الأدوية في عدن من صيدلية المصلي خلال 30–60 دقيقة: كريتر، المعلا، خورمكسر، الشيخ عثمان، المنصورة، دار سعد، البريقة والتواهي. استقبال الطلبات حتى 2 فجراً ورسوم التوصيل عبر منصة توصيل عدن.'

const FAQ = [
  {
    q: 'كم تستغرق مدة توصيل الدواء في عدن؟',
    a: 'عادةً من 30 دقيقة إلى ساعة داخل مديريات عدن، وقد تزيد قليلاً في أوقات الذروة أو للمناطق البعيدة مثل البريقة.',
  },
  {
    q: 'ما هي رسوم التوصيل؟',
    a: 'التوصيل يتم عبر منصة توصيل عدن، والرسوم تُحتسب حسب تسعيرة المنصة والمسافة إلى عنوانك، ونبلغك بالمبلغ عند تأكيد الطلب قبل الإرسال.',
  },
  {
    q: 'إلى أي ساعة يمكنني الطلب؟',
    a: 'نستقبل طلبات التوصيل حتى الساعة 2 فجراً، ويُنفَّذ الطلب مباشرة بعد المراجعة الصيدلانية وتأكيد التوفر.',
  },
  {
    q: 'هل يمكن طلب دواء يحتاج وصفة طبية؟',
    a: 'نعم، أرسل صورة واضحة للوصفة عبر واتساب أو نموذج الطلب، ويراجعها الصيدلي قبل الصرف والتوصيل.',
  },
]

const SERVICE_FACTS = [
  { label: 'مدة التوصيل', value: '30 – 60 دقيقة' },
  { label: 'آخر استقبال للطلبات', value: '2:00 فجراً' },
  { label: 'رسوم التوصيل', value: 'حسب تسعيرة منصة توصيل عدن' },
  { label: 'المراجعة الصيدلانية', value: 'لكل طلب قبل الصرف' },
]

const DISTRICTS = [
  { name: 'كريتر', note: 'مقر الصيدلية — أسرع تسليم' },
  { name: 'المعلا', note: 'توصيل يومي' },
  { name: 'خورمكسر', note: 'توصيل يومي' },
  { name: 'التواهي', note: 'توصيل يومي' },
  { name: 'الشيخ عثمان', note: 'توصيل يومي' },
  { name: 'المنصورة', note: 'توصيل يومي' },
  { name: 'دار سعد', note: 'توصيل يومي' },
  { name: 'البريقة', note: 'حسب توفر المندوب' },
]

const STEPS = [
  { title: 'أرسل طلبك', desc: 'صوّر الوصفة أو اكتب اسم الدواء عبر واتساب أو نموذج الطلب.' },
  { title: 'مراجعة صيدلانية', desc: 'يتحقق الصيدلي من التوفر والجرعة والتداخلات قبل التأكيد.' },
  { title: 'التأكيد والسعر', desc: 'نرسل لك التوفر والسعر ووقت التسليم المتوقع.' },
  { title: 'التوصيل', desc: 'يصل الطلب إلى عنوانك داخل مديريات عدن.' },
]

export const Route = createFileRoute('/delivery/aden')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: CANONICAL },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [{ rel: 'canonical', href: CANONICAL }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Pharmacy',
          name: PHARMACY.nameAr,
          alternateName: PHARMACY.nameEn,
          url: CANONICAL,
          telephone: PHARMACY.phone,
          email: PHARMACY.email,
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'كريتر',
            addressLocality: 'عدن',
            addressCountry: 'YE',
          },
          areaServed: DISTRICTS.map((d) => ({
            '@type': 'AdministrativeArea',
            name: `${d.name} — عدن`,
          })),
          openingHoursSpecification: [
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: [
                'Saturday',
                'Sunday',
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
              ],
              opens: '08:00',
              closes: '23:00',
            },
            {
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: 'Friday',
              opens: '16:00',
              closes: '23:00',
            },
          ],
          hasMap: PHARMACY.mapsUrl,
          makesOffer: {
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: 'توصيل الأدوية داخل عدن',
              serviceType: 'Medication delivery',
              provider: { '@type': 'Pharmacy', name: PHARMACY.nameAr },
              areaServed: DISTRICTS.map((d) => `${d.name} — عدن`),
            },
            description:
              'توصيل خلال 30–60 دقيقة، استقبال الطلبات حتى 2 فجراً، ورسوم التوصيل حسب تسعيرة منصة توصيل عدن.',
          },
        }),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }),
      },
    ],
  }),
  component: AdenDeliveryPage,
})

function AdenDeliveryPage() {
  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-4 py-10">
      <Reveal className="text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
          <Truck className="h-3.5 w-3.5" aria-hidden /> خدمة توصيل داخل مديريات عدن
        </p>
        <h1 className="text-fluid-title font-black text-gray-900">توصيل الأدوية في عدن</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-gray-600">
          صيدلية المصلي في كريتر توصّل الأدوية والمستلزمات الصحية إلى منزلك في عدن، مع مراجعة
          صيدلانية لكل طلب قبل الصرف. أرسل صورة الوصفة أو اسم الدواء وسنتكفّل بالباقي.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a
            href={PHARMACY.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="press-scale inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> اطلب عبر واتساب
          </a>
          <Link
            to="/request"
            className="press-scale inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md"
          >
            نموذج طلب دواء
          </Link>
          <Link
            to="/shop"
            className="press-scale inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-primary backdrop-blur"
          >
            تصفح المتجر
          </Link>
        </div>
      </Reveal>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-gray-900">المديريات التي نغطيها</h2>
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DISTRICTS.map((d) => (
            <RevealItem key={d.name}>
              <div className="glass-card flex h-full flex-col gap-1 p-4">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900">
                  <MapPin className="h-4 w-4 text-primary" aria-hidden />
                  {d.name}
                </span>
                <span className="text-xs text-gray-600">{d.note}</span>
              </div>
            </RevealItem>
          ))}
        </Stagger>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-gray-900">كيف تطلب؟</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <li key={s.title} className="glass-card flex gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-xs leading-6 text-gray-600">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="glass-card p-5">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-gray-900">
            <Clock className="h-4 w-4 text-primary" aria-hidden /> ساعات العمل
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            {PHARMACY.hoursAr.map((h) => (
              <li key={h.day} className="flex justify-between gap-3">
                <span>{h.day}</span>
                <span className="text-gray-500">{h.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass-card p-5">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-gray-900">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> تواصل مباشر
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" aria-hidden />
              <a href={`tel:${PHARMACY.phone.replace(/\s/g, '')}`} dir="ltr">
                {PHARMACY.phone}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-green-600" aria-hidden />
              <a href={PHARMACY.whatsappUrl} target="_blank" rel="noreferrer">
                واتساب
              </a>
            </li>
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <a href={PHARMACY.mapsUrl} target="_blank" rel="noreferrer">
                {PHARMACY.addressAr}
              </a>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-bold text-gray-900">قبل ما تطلب — اقرأ الدليل الدوائي</h2>
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm leading-7 text-gray-600">
            أدلة عربية مراجَعة صيدلانياً عن أكثر الأدوية استخداماً: الجرعات، التحذيرات،
            والتداخلات الدوائية.
          </p>
          <Link
            to="/guides"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            تصفّح الأدلة
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}
