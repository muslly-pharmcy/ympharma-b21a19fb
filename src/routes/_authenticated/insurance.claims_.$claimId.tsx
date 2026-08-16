import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle2, XCircle, Send, DollarSign, Ban, Archive } from 'lucide-react'
import { getInsuranceClaim } from '@/lib/insurance.functions'
import {
  submitInsuranceClaim, approveInsuranceClaim, rejectInsuranceClaim,
  recordInsurancePayment, reconcileInsuranceClaim, cancelInsuranceClaim,
} from '@/lib/insurance.mutations.functions'

export const Route = createFileRoute('/_authenticated/insurance/claims_/$claimId')({
  head: ({ params }) => ({ meta: [{ title: `مطالبة ${params.claimId.slice(0, 8)} — MUSLLY AI OS` }] }),
  component: ClaimDetailPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">المطالبة غير موجودة</div>,
})

function ClaimDetailPage() {
  const { claimId } = Route.useParams()
  const qc = useQueryClient()
  const router = useRouter()
  const { data, isLoading } = useQuery({
    queryKey: ['ins-claim', claimId],
    queryFn: () => getInsuranceClaim({ data: { id: claimId } }),
  })
  const [rejectReason, setRejectReason] = useState('')
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('')
  const [paymentRef, setPaymentRef] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ins-claim', claimId] })
    router.invalidate()
  }

  const submitM = useMutation({ mutationFn: () => submitInsuranceClaim({ data: { claimId } }), onSuccess: invalidate })
  const approveM = useMutation({ mutationFn: (partial: boolean) => approveInsuranceClaim({ data: { claimId, partial } }), onSuccess: invalidate })
  const rejectM = useMutation({
    mutationFn: () => rejectInsuranceClaim({ data: { claimId, reason: rejectReason.trim() || 'no reason' } }),
    onSuccess: () => { setRejectReason(''); invalidate() },
  })
  const payM = useMutation({
    mutationFn: () => recordInsurancePayment({ data: { claimId, amount: Number(paymentAmount), reference: paymentRef || null } }),
    onSuccess: () => { setPaymentAmount(''); setPaymentRef(''); invalidate() },
  })
  const closeM = useMutation({ mutationFn: () => reconcileInsuranceClaim({ data: { claimId } }), onSuccess: invalidate })
  const cancelM = useMutation({ mutationFn: () => cancelInsuranceClaim({ data: { claimId, reason: 'cancelled by user' } }), onSuccess: invalidate })

  if (isLoading) return <div className="p-8 text-center text-gray-500">جارٍ التحميل...</div>
  if (!data) return null
  const { claim, items, payments, history } = data

  const canSubmit = claim.status === 'draft'
  const canDecide = claim.status === 'submitted' || claim.status === 'in_review'
  const canPay = claim.status === 'approved' || claim.status === 'partially_approved'
  const canClose = ['paid','rejected','approved','partially_approved'].includes(claim.status)
  const canCancel = !['closed','cancelled','paid'].includes(claim.status)

  return (
    <div dir="rtl" className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مطالبة {claim.claim_no}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {claim.patient?.full_name ?? '—'} • {claim.provider?.name ?? '—'} • {claim.plan?.name ?? '—'}
          </p>
        </div>
        <Link to="/insurance/claims" className="text-sm text-gray-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> المطالبات
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'الحالة', value: claim.status },
          { label: 'العملة', value: claim.currency },
          { label: 'المطلوب', value: Number(claim.total_billed).toLocaleString() },
          { label: 'المسموح', value: Number(claim.total_allowed).toLocaleString() },
          { label: 'المدفوع', value: Number(claim.total_paid).toLocaleString() },
        ].map((k) => (
          <div key={k.label} className="p-3 bg-white/70 backdrop-blur rounded-xl shadow text-center">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className="font-bold mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {canSubmit && (
          <button onClick={() => submitM.mutate()} disabled={submitM.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
            <Send className="w-4 h-4" /> تقديم
          </button>
        )}
        {canDecide && (
          <>
            <button onClick={() => approveM.mutate(false)} disabled={approveM.isPending}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> اعتماد
            </button>
            <button onClick={() => approveM.mutate(true)} disabled={approveM.isPending}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> اعتماد جزئي
            </button>
          </>
        )}
        {canClose && (
          <button onClick={() => closeM.mutate()} disabled={closeM.isPending}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
            <Archive className="w-4 h-4" /> إغلاق
          </button>
        )}
        {canCancel && (
          <button onClick={() => cancelM.mutate()} disabled={cancelM.isPending}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
            <Ban className="w-4 h-4" /> إلغاء
          </button>
        )}
      </div>

      {canDecide && (
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-4 space-y-2">
          <label className="text-sm font-medium flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> رفض المطالبة</label>
          <div className="flex gap-2">
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                   placeholder="سبب الرفض..." className="flex-1 px-3 py-2 border rounded-lg" />
            <button disabled={rejectReason.trim().length < 2 || rejectM.isPending} onClick={() => rejectM.mutate()}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">تأكيد الرفض</button>
          </div>
        </div>
      )}

      {canPay && (
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow p-4 space-y-2">
          <label className="text-sm font-medium flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> تسجيل دفعة</label>
          <div className="flex gap-2">
            <input type="number" min={0} value={paymentAmount}
                   onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="المبلغ" className="w-40 px-3 py-2 border rounded-lg" />
            <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                   placeholder="مرجع الدفع (اختياري)" className="flex-1 px-3 py-2 border rounded-lg" />
            <button disabled={!paymentAmount || payM.isPending} onClick={() => payM.mutate()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">تسجيل</button>
          </div>
        </div>
      )}

      <section className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">بنود المطالبة</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-right">الوصف</th>
              <th className="px-3 py-2 text-right">الكمية</th>
              <th className="px-3 py-2 text-right">المطلوب</th>
              <th className="px-3 py-2 text-right">المسموح</th>
              <th className="px-3 py-2 text-right">Copay</th>
              <th className="px-3 py-2 text-right">المدفوع</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2">{it.quantity}</td>
                <td className="px-3 py-2">{Number(it.billed_amount).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(it.allowed_amount).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(it.copay_amount).toLocaleString()}</td>
                <td className="px-3 py-2">{Number(it.paid_amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">الدفعات</h2>
        {!payments.length ? (
          <p className="text-gray-500 py-2 text-sm">لم يتم تسجيل أي دفعات بعد.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between text-sm border-b py-2">
                <span>{new Date(p.received_at).toLocaleString('ar-SA')} — {p.method ?? 'غير محدد'}</span>
                <span className="font-mono">{Number(p.amount).toLocaleString()} {claim.currency}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white/70 backdrop-blur rounded-2xl shadow p-4">
        <h2 className="font-semibold mb-3">سجل الحالة</h2>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between text-gray-600 border-b py-1">
              <span>{h.from_status ?? '—'} → <span className="font-medium">{h.to_status}</span></span>
              <span className="text-xs text-gray-400">{new Date(h.created_at).toLocaleString('ar-SA')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
