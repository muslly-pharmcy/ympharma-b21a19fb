import { createFileRoute } from '@tanstack/react-router'
import { SeedanceStudio } from '@/components/ai/SeedanceStudio'

export const Route = createFileRoute('/_authenticated/seedance-studio')({
  head: () => ({
    meta: [
      { title: 'استوديو سيدانس السينمائي — MUSLLY' },
      {
        name: 'description',
        content: 'محرك توليد أوامر سينمائية متقدمة ومقاطع فيديو بالذكاء الاصطناعي.',
      },
      { property: 'og:title', content: 'استوديو سيدانس السينمائي — MUSLLY' },
      {
        property: 'og:description',
        content: 'أنشئ أوامر Seedance السينمائية ووَلِّد المقطع مباشرة داخل الاستوديو.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-slate-950 py-10 px-4">
      <SeedanceStudio />
    </div>
  ),
})
