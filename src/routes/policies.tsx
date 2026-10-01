import { createFileRoute } from '@tanstack/react-router'
import { ShieldCheck, Lock, RotateCcw, Truck, FileCheck2, AlertTriangle } from 'lucide-react'
import { PHARMACY } from '@/shared/branding'

export const Route = createFileRoute('/policies')({
  head: () => ({
    meta: [
      { title: `السياسات والترخيص — ${PHARMACY.nameAr}` },
      {
        name: 'description',
        content: `سياسة الخصوصية، الاستبدال والاسترجاع، التوصيل، وبيانات ترخيص ${PHARMACY.nameAr} في عدن.`,
      },
      { property: 'og:title', content: `السياسات والترخيص — ${PHARMACY.nameAr}` },
      {
        property: 'og:description',
        content: 'سياسة الخصوصية والاسترجاع والتوصيل وبيانات الترخيص والصيدلي المسؤول.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://muslly.com/policies' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [{ rel: 'canonical', href: 'https://muslly.com/policies' }],
  }),
  component: PoliciesPage,
})

type Row = { label: string; value: string | null }

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="p-6 rounded-2xl border border-gray-200 bg-white space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      <div className="text-gray-700 leading-loose space-y-2 text-sm md:text-base">{children}</div>
    </section>
  )
}

function PoliciesPage() {
  const licenseRows: Row[] = [
    { label: 'رقم الترخيص', value: PHARMACY.license.number },
    { label: 'الجهة المانحة', value: PHARMACY.license.authority },
    { label: 'سريان الترخيص', value: PHARMACY.license.expiresOn },
    { label: 'الصيدلي المسؤول', value: PHARMACY.license.responsiblePharmacist },
  ]
  const publishedRows = licenseRows.filter((r) => r.value)

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 space-y-6">
      <header className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">السياسات والترخيص</h1>
        <p className="text-gray-500">
          {PHARMACY.nameAr} — {PHARMACY.addressAr}
        </p>
      </header>

      <Section icon={FileCheck2} title="بيانات الترخيص والصيدلي المسؤول">
        {publishedRows.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {publishedRows.map((r) => (
              <li key={r.label} className="flex justify-between gap-4 py-2">
                <span className="text-gray-500">{r.label}</span>
                <span className="font-medium text-gray-900">{r.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-800">
            بيانات الترخيص الرسمية قيد التوثيق وستُنشر هنا فور اعتمادها. للاستفسار عن ترخيص
            الصيدلية يرجى التواصل على{' '}
            <a className="underline" href={`tel:${PHARMACY.phone}`} dir="ltr">
              {PHARMACY.phone}
            </a>
            .
          </p>
        )}
      </Section>

      <Section icon={Lock} title="سياسة الخصوصية">
        <p>
          نجمع فقط البيانات اللازمة لخدمتك: الاسم، رقم الهاتف، عنوان التوصيل، والوصفات أو بطاقات
          التأمين التي ترفعها بنفسك.
        </p>
        <p>
          الملفات الطبية وبطاقات التأمين تُحفظ في مساحة خاصة مغلقة، ولا يصل إليها إلا أنت وطاقم
          الصيدلية المصرّح له بخدمة طلبك.
        </p>
        <p>لا نبيع بياناتك ولا نشاركها لأغراض إعلانية مع أي طرف ثالث.</p>
        <p>
          يحق لك طلب نسخة من بياناتك أو حذف حسابك عبر التواصل معنا على{' '}
          <a className="underline" href={`mailto:${PHARMACY.email}`} dir="ltr">
            {PHARMACY.email}
          </a>
          .
        </p>
      </Section>

      <Section icon={RotateCcw} title="الاستبدال والاسترجاع">
        <p>
          لأسباب تتعلق بسلامة الدواء، لا يمكن استرجاع أو استبدال الأدوية بعد خروجها من الصيدلية
          إلا في الحالات التالية:
        </p>
        <ul className="list-disc pr-5 space-y-1">
          <li>صرف صنف مختلف عن الطلب أو عن الوصفة.</li>
          <li>وصول العبوة تالفة أو مفتوحة.</li>
          <li>قرب انتهاء الصلاحية بشكل غير مقبول وقت التسليم.</li>
        </ul>
        <p>
          يرجى إبلاغنا خلال 24 ساعة من الاستلام مع صورة للعبوة ورقم الطلب، وسنقوم بالاستبدال أو
          رد المبلغ حسب الحالة.
        </p>
        <p>الأدوية المبردة والأدوية المقيدة لا تقبل الاسترجاع بعد التسليم.</p>
      </Section>

      <Section icon={Truck} title="التوصيل">
        <p>
          يتم تحديد موعد التوصيل داخل عدن حسب المنطقة وتوفر الأصناف، ويُبلّغ العميل بالموعد قبل
          الخروج للتوصيل.
        </p>
        <p>
          التوفر المعروض في المتجر إرشادي، ويُؤكَّد نهائياً عند مراجعة الطلب من الصيدلية. إذا لم
          يتوفر صنف سنتواصل معك لاقتراح بديل أو إلغائه من الطلب.
        </p>
      </Section>

      <Section icon={AlertTriangle} title="تنبيه طبي">
        <p>
          المعلومات والأدوات والمساعد الذكي في هذا الموقع للإرشاد العام فقط، ولا تغني عن استشارة
          الطبيب أو الصيدلي.
        </p>
        <p>لا تبدأ أو توقف أي دواء بناءً على ما يظهر هنا دون الرجوع لمختص.</p>
        <p>في حالات الطوارئ توجه مباشرة لأقرب مرفق صحي.</p>
      </Section>

      <Section icon={ShieldCheck} title="الوصفات الطبية">
        <p>الأدوية التي تتطلب وصفة لا تُصرف إلا بعد مراجعة صيدلي ووصفة سارية.</p>
        <p>يحتفظ الصيدلي بحق رفض أو تعليق الصرف عند وجود تداخل دوائي أو شك في صحة الوصفة.</p>
      </Section>
    </div>
  )
}
