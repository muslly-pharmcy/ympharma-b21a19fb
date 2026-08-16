import { createFileRoute } from '@tanstack/react-router'
import { FamilyHealthProfile } from '@/components/account/FamilyHealthProfile'

export const Route = createFileRoute('/_authenticated/family-health')({
  head: () => ({
    meta: [
      { title: 'المحفظة الصحية للعائلة | صيدلية المصلي' },
      {
        name: 'description',
        content:
          'أدر الملفات الصحية لأفراد أسرتك: الحساسيات، الأمراض المزمنة، الأدوية الحالية وفصائل الدم للحصول على تنبيهات أمان دوائية دقيقة.',
      },
      { property: 'og:title', content: 'المحفظة الصحية للعائلة | صيدلية المصلي' },
      {
        property: 'og:description',
        content: 'ملفات صحية لأفراد الأسرة مع فحص تلقائي لأمان الأدوية عند الطلب.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: FamilyHealthPage,
})

function FamilyHealthPage() {
  return (
    <main dir="rtl" className="mx-auto w-full max-w-4xl px-4 py-8">
      <FamilyHealthProfile />
    </main>
  )
}
