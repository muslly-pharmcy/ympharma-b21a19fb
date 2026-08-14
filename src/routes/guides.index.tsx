import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpenCheck, ArrowLeft } from 'lucide-react'
import { DRUG_GUIDES, PHARMACIST_DISCLAIMER } from '@/lib/content/drug-guides'
import { Reveal, Stagger, RevealItem } from '@/shared/components/motion/Reveal'

const CANONICAL = 'https://muslly.com/guides'
const TITLE = 'الأدلة الدوائية العربية — صيدلية المصلي'
const DESCRIPTION =
  'أدلة دوائية عربية مراجَعة صيدلانياً: أوميبرازول، باراسيتامول، فيتامين C والزنك، مضادات الهيستامين، ومضادات الحموضة — الجرعات والتحذيرات والتداخلات مع إمكانية الطلب من صيدلية المصلي.'

export const Route = createFileRoute('/guides/')({
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
          '@type': 'ItemList',
          name: TITLE,
          itemListElement: DRUG_GUIDES.map((g, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: g.title,
            url: `https://muslly.com/guides/${g.slug}`,
          })),
        }),
      },
    ],
  }),
  component: GuidesIndex,
})

function GuidesIndex() {
  return (
    <div dir="rtl" className="mx-auto max-w-5xl px-4 py-10">
      <Reveal className="mb-6 text-center">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-[11px] font-semibold text-primary backdrop-blur">
          <BookOpenCheck className="h-3.5 w-3.5" aria-hidden /> محتوى مراجَع صيدلانياً
        </p>
        <h1 className="text-fluid-title font-black text-gray-900">الأدلة الدوائية</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">
          شروحات عربية مبسّطة لأكثر الأدوية استخداماً: متى تُستخدم، كيف تُؤخذ، وما التحذيرات
          والتداخلات المهمة.
        </p>
      </Reveal>

      <p className="mb-6 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
        {PHARMACIST_DISCLAIMER}
      </p>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DRUG_GUIDES.map((g) => (
          <RevealItem key={g.slug}>
            <Link
              to="/guides/$guideId"
              params={{ guideId: g.slug }}
              preload="intent"
              className="glass-card press-scale group flex h-full flex-col gap-2 p-5"
            >
              <h2 className="text-base font-bold text-gray-900">{g.title}</h2>
              <p className="text-xs leading-6 text-gray-600">{g.subtitle}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
                اقرأ الدليل
                <ArrowLeft
                  className="h-3.5 w-3.5 transition group-hover:-translate-x-1"
                  aria-hidden
                />
              </span>
            </Link>
          </RevealItem>
        ))}
      </Stagger>
    </div>
  )
}
