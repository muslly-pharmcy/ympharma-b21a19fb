import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Shield, ArrowLeft } from 'lucide-react'
import { listInsuranceProviders, listInsurancePlans } from '@/lib/insurance.functions'

export const Route = createFileRoute('/_authenticated/insurance/')({
  head: () => ({ meta: [
    { title: 'التأمين — MUSLLY AI OS' },
    { name: 'description', content: 'إدارة شركات التأمين والخطط الطبية' },
  ] }),
  component: InsuranceHomePage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function InsuranceHomePage() {
  const [search, setSearch] = useState('')
  const providersQ = useQuery({
    queryKey: ['ins-providers', search],
    queryFn: () => listInsuranceProviders({ data: { search: search || undefined, activeOnly: true } }),
  })
  const plansQ = useQuery({
    queryKey: ['ins-plans'],
    queryFn: () => listInsurancePlans({ data: { activeOnly: true } }),
  })

  return (
    <div dir="rtl" className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7 text-indigo-600" />
          منصة التأمين
        </h1>
        <div className="flex gap-2 text-sm">
          <Link to="/insurance/coverage" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100">التحقق من التغطية</Link>
          <Link to="/insurance/claims" className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">المطالبات</Link>
          <Link to="/patients" className="px-3 py-1.5 text-gray-600 hover:underline flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> المرضى
          </Link>
        </div>
      </div>

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث في شركات التأمين..."
        className="w-full px-4 py-2 border rounded-lg"
      />

      <section className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">شركات التأمين</h2>
        {providersQ.isLoading ? (
          <p className="text-gray-500 py-6 text-center">جارٍ التحميل...</p>
        ) : !providersQ.data?.providers.length ? (
          <p className="text-gray-500 py-6 text-center">لا توجد شركات مسجّلة بعد.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {providersQ.data.providers.map((p) => (
              <div key={p.id} className="p-4 border rounded-xl bg-white hover:shadow transition">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{p.name}</p>
                  <span className="text-xs text-gray-400 font-mono">{p.code}</span>
                </div>
                {p.name_en && <p className="text-xs text-gray-500">{p.name_en}</p>}
                {p.phone && <p className="text-sm mt-2 text-gray-600">{p.phone}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">الخطط التأمينية</h2>
        {plansQ.isLoading ? (
          <p className="text-gray-500 py-6 text-center">جارٍ التحميل...</p>
        ) : !plansQ.data?.plans.length ? (
          <p className="text-gray-500 py-6 text-center">لا توجد خطط مسجّلة بعد.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-right">الخطة</th>
                <th className="px-3 py-2 text-right">الشركة</th>
                <th className="px-3 py-2 text-right">المستوى</th>
                <th className="px-3 py-2 text-right">التغطية</th>
                <th className="px-3 py-2 text-right">Copay</th>
              </tr>
            </thead>
            <tbody>
              {plansQ.data.plans.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-gray-600">{p.provider?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{p.tier ?? '—'}</td>
                  <td className="px-3 py-2">{p.coverage_percent}%</td>
                  <td className="px-3 py-2">{p.copay_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
