import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { PackageCheck, ArrowLeft } from 'lucide-react'
import { listDispenses } from '@/lib/dispenses.functions'

export const Route = createFileRoute('/_authenticated/dispenses')({
  head: () => ({ meta: [{ title: 'الصرف — MUSLLY AI OS' }] }),
  component: DispensesListPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', prepared: 'مُحضّرة', verified: 'مُتحقق منها',
  dispensed: 'مصروفة', completed: 'مكتملة', returned: 'مُرتجعة', cancelled: 'ملغاة',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  prepared: 'bg-blue-100 text-blue-700',
  verified: 'bg-amber-100 text-amber-700',
  dispensed: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-700',
}

function DispensesListPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['dispenses', { status, search }],
    queryFn: () => listDispenses({ data: { status: status || undefined, search: search || undefined, limit: 100 } }),
  })

  return (
    <div dir="rtl" className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageCheck className="w-7 h-7 text-emerald-600" />
          الصرف الدوائي
        </h1>
        <Link to="/prescriptions" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> الوصفات الطبية
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الصرف..."
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
        ) : !data?.dispenses.length ? (
          <div className="p-8 text-center text-gray-500">لا توجد سجلات صرف. أنشئ صرفاً من صفحة وصفة معتمدة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-right">رقم الصرف</th>
                <th className="px-4 py-2 text-right">المريض</th>
                <th className="px-4 py-2 text-right">الوصفة</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data.dispenses.map((d) => (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">
                    <Link to="/dispenses/$dispenseId" params={{ dispenseId: d.id }} className="text-blue-600 hover:underline">
                      {d.dispense_no ?? d.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{d.patient?.full_name ?? '—'}</td>
                  <td className="px-4 py-2 font-mono">{d.prescription?.prescription_no ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLOR[d.status] ?? ''}`}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{new Date(d.created_at).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
