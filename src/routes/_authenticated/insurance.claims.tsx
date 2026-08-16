import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, ArrowLeft } from 'lucide-react'
import { listInsuranceClaims } from '@/lib/insurance.functions'

export const Route = createFileRoute('/_authenticated/insurance/claims')({
  head: () => ({ meta: [{ title: 'مطالبات التأمين — MUSLLY AI OS' }] }),
  component: ClaimsListPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', submitted: 'مُقدَّمة', in_review: 'قيد المراجعة',
  approved: 'مُعتمَدة', partially_approved: 'اعتماد جزئي',
  rejected: 'مرفوضة', paid: 'مدفوعة', closed: 'مُغلَقة', cancelled: 'ملغاة',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  partially_approved: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-orange-100 text-orange-700',
}

function ClaimsListPage() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['ins-claims', { status, search }],
    queryFn: () => listInsuranceClaims({ data: { status: status || undefined, search: search || undefined, limit: 100 } }),
  })

  return (
    <div dir="rtl" className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-7 h-7 text-indigo-600" />
          مطالبات التأمين
        </h1>
        <Link to="/insurance" className="text-sm text-gray-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> التأمين
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم المطالبة..."
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-4 py-2 border rounded-lg">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
        ) : !data?.claims.length ? (
          <div className="p-8 text-center text-gray-500">لا توجد مطالبات. أنشئ مطالبة من صفحة الصرف.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-right">رقم المطالبة</th>
                <th className="px-4 py-2 text-right">المريض</th>
                <th className="px-4 py-2 text-right">الشركة</th>
                <th className="px-4 py-2 text-right">الحالة</th>
                <th className="px-4 py-2 text-right">المطلوب</th>
                <th className="px-4 py-2 text-right">المدفوع</th>
                <th className="px-4 py-2 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data.claims.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">
                    <Link to="/insurance/claims/$claimId" params={{ claimId: c.id }} className="text-indigo-600 hover:underline">
                      {c.claim_no ?? c.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.patient?.full_name ?? '—'}</td>
                  <td className="px-4 py-2">{c.provider?.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLOR[c.status] ?? ''}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{Number(c.total_billed).toLocaleString()} {c.currency}</td>
                  <td className="px-4 py-2">{Number(c.total_paid).toLocaleString()} {c.currency}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(c.created_at).toLocaleDateString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
