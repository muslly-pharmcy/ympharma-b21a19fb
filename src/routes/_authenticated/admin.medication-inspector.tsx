import { createFileRoute } from '@tanstack/react-router'
import { PatientMedicationInspector } from '@/components/admin/PatientMedicationInspector'

export const Route = createFileRoute('/_authenticated/admin/medication-inspector')({
  head: () => ({
    meta: [
      { title: 'المفتّش السريري للأدوية | لوحة الصيدلي' },
      {
        name: 'description',
        content:
          'أداة الصيدلي لمراجعة الأدوية المزمنة للمرضى، صور العلب الدوائية، وفحص التداخلات الدوائية قبل الصرف.',
      },
      { property: 'og:title', content: 'المفتّش السريري للأدوية | لوحة الصيدلي' },
      {
        property: 'og:description',
        content: 'مراجعة سريرية سريعة لأدوية المرضى مع فحص تداخلات فوري.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: () => (
    <main dir="rtl" className="mx-auto w-full max-w-3xl px-4 py-8">
      <PatientMedicationInspector />
    </main>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600" dir="rtl">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">الصفحة غير موجودة</div>,
})
