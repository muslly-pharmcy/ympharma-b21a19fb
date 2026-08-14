import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ShoppingBag, ArrowLeft, Stethoscope } from 'lucide-react'
import { DRUG_GUIDES, getGuide, PHARMACIST_DISCLAIMER } from '@/lib/content/drug-guides'
import { Reveal } from '@/shared/components/motion/Reveal'

export const Route = createFileRoute('/guides/$guideId')({
  loader: ({ params }) => {
    const guide = getGuide(params.guideId)
    if (!guide) throw notFound()
    return { guide }
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: 'الدليل غير متاح — صيدلية المصلي' }, { name: 'robots', content: 'noindex' }],
      }
    }
    const g = loaderData.guide
    const url = `https://muslly.com/guides/${params.guideId}`
    return {
      meta: [
        { title: g.metaTitle },
        { name: 'description', content: g.metaDescription },
        { property: 'og:title', content: g.metaTitle },
        { property: 'og:description', content: g.metaDescription },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: url },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: g.metaTitle },
        { name: 'twitter:description', content: g.metaDescription },
      ],
      links: [{ rel: 'canonical', href: url }],
      scripts: [
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MedicalWebPage',
            name: g.title,
            headline: g.metaTitle,
            description: g.metaDescription,
            url,
            inLanguage: 'ar',
            about: { '@type': 'Drug', name: g.title },
            publisher: {
              '@type': 'Pharmacy',
              name: 'صيدلية المصلي',
              url: 'https://muslly.com',
            },
          }),
        },
        {
          type: 'application/ld+json',
          children: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: g.faqs.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        },
      ],
    }
  },
  notFoundComponent: GuideNotFound,
  component: GuidePage,
})

function GuidePage() {
  const { guide } = Route.useLoaderData()
  const others = DRUG_GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 4)

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-4 py-10">
      <Reveal>
        <nav className="mb-3 text-xs text-gray-500">
          <Link to="/guides" className="hover:text-primary">
            الأدلة الدوائية
          </Link>
          <span className="mx-1">/</span>
          <span className="text-gray-700">{guide.title}</span>
        </nav>
        <h1 className="text-fluid-title font-black text-gray-900">{guide.title}</h1>
        <p className="mt-2 text-sm leading-7 text-gray-600">{guide.subtitle}</p>
      </Reveal>

      <p className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
        {PHARMACIST_DISCLAIMER}
      </p>

      <p className="mt-5 text-sm leading-8 text-gray-700">{guide.intro}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/search"
          search={{ q: guide.searchTerm }}
          className="press-scale inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md"
        >
          <ShoppingBag className="h-4 w-4" aria-hidden /> اطلب الآن من صيدلية المصلي
        </Link>
        <Link
          to="/tools/interactions"
          className="press-scale inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-primary backdrop-blur"
        >
          <Stethoscope className="h-4 w-4" aria-hidden /> افحص التداخلات الدوائية
        </Link>
      </div>

      {guide.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-lg font-bold text-gray-900">{section.heading}</h2>
          <ul className="mt-2 list-disc space-y-2 pr-5 text-sm leading-8 text-gray-700">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-gray-900">أسئلة شائعة</h2>
        <div className="mt-3 space-y-3">
          {guide.faqs.map((f) => (
            <div key={f.q} className="glass-card p-4">
              <h3 className="text-sm font-bold text-gray-900">{f.q}</h3>
              <p className="mt-1 text-sm leading-7 text-gray-600">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-gray-900">أدلة أخرى قد تهمّك</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link
                to="/guides/$guideId"
                params={{ guideId: g.slug }}
                className="glass-card press-scale flex items-center justify-between gap-2 p-4 text-sm font-semibold text-gray-900"
              >
                {g.title}
                <ArrowLeft className="h-3.5 w-3.5 text-primary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}

function GuideNotFound() {
  return (
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-black text-gray-900">هذا الدليل غير متاح</h1>
      <p className="mt-2 text-sm leading-7 text-gray-600">
        قد يكون الرابط قديماً أو غير صحيح. يمكنك تصفّح الأدلة المتاحة أو الانتقال مباشرة إلى
        المتجر.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to="/guides"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          كل الأدلة
        </Link>
        <Link
          to="/shop"
          className="rounded-xl border border-primary/30 bg-white/70 px-5 py-2.5 text-sm font-semibold text-primary"
        >
          تصفّح المتجر
        </Link>
      </div>
      <ul className="mt-8 grid grid-cols-1 gap-2 text-right sm:grid-cols-2">
        {DRUG_GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              to="/guides/$guideId"
              params={{ guideId: g.slug }}
              className="glass-card block p-3 text-sm font-semibold text-gray-900"
            >
              {g.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
