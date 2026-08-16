import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from 'lucide-react'
import { listPatients } from '@/lib/patients.functions'
import { getPatientCoverage } from '@/lib/insurance.functions'
import { verifyCoverage } from '@/lib/insurance.mutations.functions'
import { useAuth } from '@/context/AuthContext'

export const Route = createFileRoute('/_authenticated/insurance/coverage')({
  head: () => ({ meta: [{ title: 'التحقق من التغطية التأمينية — MUSLLY AI OS' }] }),
  component: CoveragePage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
})

function CoveragePage() {
  const { user } = useAuth()
  const [patientId, setPatientId] = useState('')
  const [result, setResult] = useState<{ eligible: boolean; onDate: string } | null>(null)

  const patientsQ = useQuery({ queryKey: ['patients-slim'], queryFn: () => listPatients() })
  const coverageQ = useQuery({
    queryKey: ['patient-coverage', patientId],
    queryFn: () => getPatientCoverage({ data: { patientId } }),
    enabled: Boolean(patientId),
  })

  const verifyM = useMutation({
    mutationFn: (organizationId: string) =>
      verifyCoverage({ data: { organizationId, patientId } }),
    onSuccess: (r) => setResult({ eligible: r.eligible, onDate: r.onDate }),
  })

  const orgId = user?.user_metadata?.organization_id as string | undefined

  return (
    <div dir="rtl" className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-indigo-600" />
          التحقق من التغطية التأمينية
        </h1>
        <Link to="/insurance" className="text-sm text-gray-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> التأمين
        </Link>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-4 space-y-3">
        <label className="block text-sm font-medium">اختر مريضاً</label>
        <select
          value={patientId} onChange={(e) => { setPatientId(e.target.value); setResult(null) }}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="">— اختر —</option>
          {(patientsQ.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.full_name} {p.mrn ? `• ${p.mrn}` : ''}</option>
          ))}
        </select>
        <button
          disabled={!patientId || !orgId || verifyM.isPending}
          onClick={() => orgId && verifyM.mutate(orgId)}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700"
        >
          {verifyM.isPending ? 'جارٍ التحقق...' : 'تحقق من التغطية اليوم'}
        </button>
      </div>

      {result && (
        <div className={`p-4 rounded-2xl flex items-center gap-2 ${result.eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {result.eligible ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>
            {result.eligible
              ? `المريض مؤمَّن كما في ${result.onDate}`
              : `لا توجد تغطية فعّالة كما في ${result.onDate}`}
          </span>
        </div>
      )}

      {patientId && coverageQ.data && (
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
          <h2 className="font-semibold mb-3">وثائق التأمين المسجَّلة</h2>
          {!coverageQ.data.coverage.length ? (
            <p className="text-gray-500 py-4 text-center">لا توجد وثائق تأمين مرتبطة بهذا المريض.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-right">الأولوية</th>
                  <th className="px-3 py-2 text-right">رقم الوثيقة</th>
                  <th className="px-3 py-2 text-right">الخطة</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">من — إلى</th>
                </tr>
              </thead>
              <tbody>
                {coverageQ.data.coverage.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 uppercase">{c.priority}</td>
                    <td className="px-3 py-2 font-mono">{c.policy_number}</td>
                    <td className="px-3 py-2">{c.plan?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {(c.valid_from ?? '—')} → {(c.valid_to ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
