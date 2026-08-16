import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Stethoscope, Building2, Pill, Phone, Video, Zap } from 'lucide-react'
import {
  searchAdenDirectory,
  findSuppliersByCompany,
  listProductsByAgent,
} from '@/lib/medical-directory.functions'

type Tab = 'doctors' | 'suppliers' | 'agents'

export const Route = createFileRoute('/_authenticated/medical-directory')({
  head: () => ({
    meta: [
      { title: 'الدليل الطبي — MUSLLY AI OS' },
      {
        name: 'description',
        content:
          'ابحث عن الأطباء والمشافي والموردين ووكلاء الأدوية في شبكة عدن الطبية.',
      },
      { property: 'og:title', content: 'الدليل الطبي — عدن' },
      {
        property: 'og:description',
        content: 'شبكة عدن الطبية: أطباء، موردون، ووكلاء أدوية الهيئة العليا.',
      },
    ],
  }),
  component: MedicalDirectoryPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">فشل تحميل الدليل: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function MedicalDirectoryPage() {
  const [tab, setTab] = useState<Tab>('doctors')
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const doctors = useQuery({
    queryKey: ['directory', 'doctors', submitted],
    queryFn: () => searchAdenDirectory({ data: { query: submitted, limit: 20 } }),
    enabled: tab === 'doctors',
  })

  const suppliers = useQuery({
    queryKey: ['directory', 'suppliers', submitted],
    queryFn: () => findSuppliersByCompany({ data: { query: submitted, limit: 20 } }),
    enabled: tab === 'suppliers',
  })

  const agentProducts = useQuery({
    queryKey: ['directory', 'agent-products', submitted],
    queryFn: () => listProductsByAgent({ data: { agent: submitted, limit: 50 } }),
    enabled: tab === 'agents' && submitted.length > 0,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" dir="rtl">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Stethoscope className="h-8 w-8 text-teal-600" />
          الدليل الطبي — عدن
        </h1>
        <p className="text-sm text-muted-foreground">
          ابحث في شبكة الأطباء، الموردين، ووكلاء الأدوية المسجّلين لدى الهيئة العليا للأدوية (SBDMA).
        </p>
      </header>

      <nav className="flex gap-2 border-b border-border">
        <TabBtn active={tab === 'doctors'} onClick={() => setTab('doctors')} icon={<Stethoscope className="h-4 w-4" />} label="الأطباء" />
        <TabBtn active={tab === 'suppliers'} onClick={() => setTab('suppliers')} icon={<Building2 className="h-4 w-4" />} label="الموردون" />
        <TabBtn active={tab === 'agents'} onClick={() => setTab('agents')} icon={<Pill className="h-4 w-4" />} label="وكلاء الأدوية" />
      </nav>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(query.trim())
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === 'doctors'
                ? 'ابحث عن طبيب (الاسم)…'
                : tab === 'suppliers'
                  ? 'ابحث عن مورّد (الاسم أو الشركة)…'
                  : 'اكتب اسم الوكيل لعرض منتجاته…'
            }
            className="w-full rounded-xl border border-border bg-background py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700"
        >
          بحث
        </button>
      </form>

      {tab === 'doctors' && (
        <ResultsBlock
          isLoading={doctors.isFetching}
          isEmpty={!doctors.data || doctors.data.length === 0}
          emptyLabel="لا توجد نتائج مطابقة في دليل الأطباء."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {doctors.data?.map((d) => (
              <article
                key={d.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  {d.photo_url ? (
                    <img
                      src={d.photo_url}
                      alt=""
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-teal-100 text-teal-700">
                      <Stethoscope className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {d.title ? `${d.title} ` : ''}
                      {d.full_name_ar}
                    </h3>
                    {d.full_name_en && (
                      <p className="text-xs text-muted-foreground truncate">{d.full_name_en}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {d.years_experience != null && (
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {d.years_experience} سنة خبرة
                        </span>
                      )}
                      {d.telemedicine_ready && (
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 flex items-center gap-1">
                          <Video className="h-3 w-3" /> تطبيب عن بُعد
                        </span>
                      )}
                      {d.emergency_available && (
                        <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> طوارئ
                        </span>
                      )}
                    </div>
                    {(d.consultation_fee_min != null || d.consultation_fee_max != null) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        الكشف: {d.consultation_fee_min ?? '—'}
                        {d.consultation_fee_max ? ` — ${d.consultation_fee_max}` : ''} {d.currency}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </ResultsBlock>
      )}

      {tab === 'suppliers' && (
        <ResultsBlock
          isLoading={suppliers.isFetching}
          isEmpty={!suppliers.data || suppliers.data.length === 0}
          emptyLabel="لا يوجد موردون مطابقون."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {suppliers.data?.map((s) => {
              const contact = (s.contact ?? {}) as { phone?: string; email?: string }
              return (
                <article
                  key={s.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{s.name}</h3>
                      {s.legal_name && (
                        <p className="text-xs text-muted-foreground truncate">{s.legal_name}</p>
                      )}
                      {contact.phone && (
                        <p className="mt-2 text-xs flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </p>
                      )}
                      {s.code && (
                        <p className="mt-1 text-xs text-muted-foreground">الكود: {s.code}</p>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </ResultsBlock>
      )}

      {tab === 'agents' && (
        <ResultsBlock
          isLoading={agentProducts.isFetching}
          isEmpty={submitted.length > 0 && (!agentProducts.data || agentProducts.data.length === 0)}
          emptyLabel="لا توجد منتجات مسجّلة لهذا الوكيل."
        >
          {submitted.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              اكتب اسم الوكيل (مثال: Pharma Care) لعرض منتجاته وأسعار الهيئة الرسمية.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-right">المنتج</th>
                    <th className="p-3 text-right">الشركة</th>
                    <th className="p-3 text-right">بلد المنشأ</th>
                    <th className="p-3 text-right">السعر الرسمي (SBDMA)</th>
                    <th className="p-3 text-right">وصفة؟</th>
                  </tr>
                </thead>
                <tbody>
                  {agentProducts.data?.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3 font-medium">{p.name_ar}</td>
                      <td className="p-3 text-muted-foreground">{p.manufacturer ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">{p.manufacturer_country ?? '—'}</td>
                      <td className="p-3 tabular-nums">
                        {p.sbdma_official_price != null
                          ? `${p.sbdma_official_price} YER`
                          : '—'}
                      </td>
                      <td className="p-3">
                        {p.requires_prescription ? (
                          <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">
                            نعم
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">لا</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ResultsBlock>
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-teal-600 text-teal-700'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function ResultsBlock({
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  isLoading: boolean
  isEmpty: boolean
  emptyLabel: string
  children: React.ReactNode
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    )
  }
  if (isEmpty) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }
  return <>{children}</>
}
