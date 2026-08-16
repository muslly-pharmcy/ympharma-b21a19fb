import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, ArrowRight, Trash2, Send, CheckCircle2, ShieldCheck, XCircle, Clock } from 'lucide-react'
import { getPrescription } from '@/lib/prescriptions.functions'
import {
  addPrescriptionItem, removePrescriptionItem, transitionPrescription,
  addPrescriptionNote, updatePrescription,
} from '@/lib/prescriptions.mutations.functions'
import { ALLOWED_TRANSITIONS, type PrescriptionStatus } from '@/domain/prescriptions/schemas'
import { ClinicalWarningsPanel } from '@/components/clinical/ClinicalWarningsPanel'

export const Route = createFileRoute('/_authenticated/prescriptions/$prescriptionId')({
  head: () => ({ meta: [{ title: 'ملف الوصفة — MUSLLY AI OS' }] }),
  component: PrescriptionDetailPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">الوصفة غير موجودة</div>,
})

const STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة', submitted: 'مُرسلة', validated: 'مُتحقق منها', approved: 'معتمدة', cancelled: 'ملغاة',
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  validated: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}
const TRANSITION_LABEL: Record<string, { label: string; Icon: typeof Send }> = {
  submitted: { label: 'إرسال', Icon: Send },
  validated: { label: 'تحقق', Icon: ShieldCheck },
  approved:  { label: 'اعتماد', Icon: CheckCircle2 },
  cancelled: { label: 'إلغاء', Icon: XCircle },
}

function PrescriptionDetailPage() {
  const { prescriptionId } = Route.useParams()
  const qc = useQueryClient()
  const { data, isFetching } = useQuery({
    queryKey: ['prescription', prescriptionId],
    queryFn: () => getPrescription({ data: { id: prescriptionId } }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['prescription', prescriptionId] })

  if (isFetching && !data) return <div className="p-8">جاري التحميل...</div>
  if (!data) return <div className="p-8 text-center">الوصفة غير موجودة</div>
  const { prescription: rx, items, history, notes } = data
  const nextStates = ALLOWED_TRANSITIONS[rx.status] ?? []
  const isDraft = rx.status === 'draft'

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link to="/prescriptions" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-4 w-4" /> عودة للقائمة
      </Link>

      <header className="glass-panel flex items-start justify-between gap-4 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">وصفة {rx.prescription_no ?? rx.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              {rx.patient?.full_name ?? '—'} • {rx.doctor?.full_name_ar ?? rx.external_doctor_name ?? 'بدون طبيب'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              صدرت في {new Date(rx.issued_at).toLocaleDateString('ar')}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-4 py-2 text-sm font-medium ${STATUS_COLOR[rx.status]}`}>
          {STATUS_LABEL[rx.status]}
        </span>
      </header>

      {nextStates.length > 0 && (
        <section className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-4">
          <span className="text-sm text-muted-foreground">الإجراءات المتاحة:</span>
          {nextStates.map((to) => (
            <TransitionButton key={to} prescriptionId={prescriptionId} to={to} onDone={invalidate} />
          ))}
        </section>
      )}

      {rx.diagnosis && (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-2 text-lg font-semibold">التشخيص</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{rx.diagnosis}</p>
        </section>
      )}

      <ClinicalWarningsPanel prescriptionId={rx.id} />



      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold">الأدوية ({items.length})</h2>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد أدوية في هذه الوصفة</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-start justify-between rounded-xl border border-gray-100 p-3">
                <div className="flex-1">
                  <p className="font-medium">
                    {it.medication_name}
                    {it.strength && <span className="text-muted-foreground"> • {it.strength}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {[it.dose, it.frequency, it.duration_days && `${it.duration_days} يوم`, it.route]
                      .filter(Boolean).join(' • ') || '—'}
                  </p>
                  {it.instructions && <p className="text-xs text-gray-500 mt-1">📝 {it.instructions}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">×{it.quantity}</span>
                  {isDraft && (
                    <RemoveItemButton prescriptionId={prescriptionId} itemId={it.id} onDone={invalidate} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {isDraft && <AddItemForm prescriptionId={prescriptionId} onDone={invalidate} />}
        {!isDraft && (
          <p className="mt-3 text-xs text-amber-700">لا يمكن تعديل الأدوية بعد إرسال الوصفة</p>
        )}
      </section>

      {!isDraft ? null : <EditMetadataForm rx={rx} onDone={invalidate} />}

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5" /> سجل الحالة
        </h2>
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-sm">
              <div className={`mt-1 h-2 w-2 rounded-full ${STATUS_COLOR[h.to_status]?.split(' ')[0] ?? 'bg-gray-300'}`} />
              <div className="flex-1">
                <p>
                  {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : ''}
                  <span className="font-medium">{STATUS_LABEL[h.to_status]}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(h.created_at).toLocaleString('ar')}
                  {h.reason && <> • {h.reason}</>}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 text-lg font-semibold">الملاحظات ({notes.length})</h2>
        {notes.length === 0
          ? <p className="py-2 text-center text-sm text-muted-foreground">لا توجد ملاحظات</p>
          : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('ar')}</p>
                </li>
              ))}
            </ul>
          )}
        <AddNoteForm prescriptionId={prescriptionId} onDone={invalidate} />
      </section>
    </div>
  )
}

function TransitionButton({ prescriptionId, to, onDone }: {
  prescriptionId: string; to: PrescriptionStatus; onDone: () => void
}) {
  const cfg = TRANSITION_LABEL[to]
  const mut = useMutation({
    mutationFn: (reason: string | null) => transitionPrescription({ data: { prescriptionId, to: to as 'submitted' | 'validated' | 'approved' | 'cancelled', reason } }),
    onSuccess: onDone,
  })
  const onClick = () => {
    const reason = to === 'cancelled' ? window.prompt('سبب الإلغاء (اختياري):') : null
    mut.mutate(reason)
  }
  if (!cfg) return null
  const { Icon, label } = cfg
  return (
    <button onClick={onClick} disabled={mut.isPending}
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-60 ${
        to === 'cancelled' ? 'bg-red-600' : 'bg-primary'}`}>
      <Icon className="h-4 w-4" /> {mut.isPending ? '...' : label}
      {mut.error && <span className="ms-2 text-xs">{(mut.error as Error).message}</span>}
    </button>
  )
}

function RemoveItemButton({ prescriptionId, itemId, onDone }: {
  prescriptionId: string; itemId: string; onDone: () => void
}) {
  const mut = useMutation({
    mutationFn: () => removePrescriptionItem({ data: { prescriptionId, itemId } }),
    onSuccess: onDone,
  })
  return (
    <button onClick={() => mut.mutate()} disabled={mut.isPending}
      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50">
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

function AddItemForm({ prescriptionId, onDone }: { prescriptionId: string; onDone: () => void }) {
  const [medication_name, setName] = useState('')
  const [strength, setStrength] = useState('')
  const [dose, setDose] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration_days, setDur] = useState('')
  const [quantity, setQty] = useState('1')
  const [instructions, setIns] = useState('')

  const mut = useMutation({
    mutationFn: () => addPrescriptionItem({ data: { prescriptionId, item: {
      medication_name, strength: strength || null, dose: dose || null,
      frequency: frequency || null, duration_days: duration_days ? Number(duration_days) : null,
      quantity: Number(quantity) || 1, instructions: instructions || null,
    } } }),
    onSuccess: () => {
      setName(''); setStrength(''); setDose(''); setFrequency(''); setDur(''); setQty('1'); setIns('')
      onDone()
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (medication_name.trim()) mut.mutate() }}
      className="mt-4 grid gap-2 rounded-xl bg-primary/5 p-3 sm:grid-cols-3">
      <input value={medication_name} onChange={(e) => setName(e.target.value)} placeholder="اسم الدواء *"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right sm:col-span-2" required />
      <input value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="التركيز (500mg)"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="الجرعة"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="التكرار (3× يومياً)"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={duration_days} onChange={(e) => setDur(e.target.value)} type="number" placeholder="المدة (أيام)"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={quantity} onChange={(e) => setQty(e.target.value)} type="number" step="0.001" placeholder="الكمية"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={instructions} onChange={(e) => setIns(e.target.value)} placeholder="تعليمات إضافية"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right sm:col-span-2" />
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60 sm:col-span-3">
        {mut.isPending ? '...' : '+ إضافة دواء'}
      </button>
      {mut.error && <p className="text-xs text-red-600 sm:col-span-3">{(mut.error as Error).message}</p>}
    </form>
  )
}

function EditMetadataForm({ rx, onDone }: {
  rx: { id: string; prescription_no: string | null; external_doctor_name: string | null; diagnosis: string | null }
  onDone: () => void
}) {
  const [prescription_no, setNo] = useState(rx.prescription_no ?? '')
  const [external_doctor_name, setDoc] = useState(rx.external_doctor_name ?? '')
  const [diagnosis, setDiag] = useState(rx.diagnosis ?? '')

  const mut = useMutation({
    mutationFn: () => updatePrescription({ data: { id: rx.id, patch: {
      prescription_no: prescription_no || null,
      external_doctor_name: external_doctor_name || null,
      diagnosis: diagnosis || null,
    } } }),
    onSuccess: onDone,
  })

  return (
    <section className="glass-panel rounded-2xl p-6">
      <h2 className="mb-4 text-lg font-semibold">تعديل بيانات الوصفة</h2>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate() }} className="grid gap-2 sm:grid-cols-2">
        <input value={prescription_no} onChange={(e) => setNo(e.target.value)} placeholder="رقم الوصفة"
          className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
        <input value={external_doctor_name} onChange={(e) => setDoc(e.target.value)} placeholder="اسم الطبيب"
          className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
        <textarea value={diagnosis} onChange={(e) => setDiag(e.target.value)} placeholder="التشخيص"
          rows={2} className="rounded-lg border border-gray-200 p-2 text-sm text-right sm:col-span-2" />
        <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60 sm:col-span-2">
          {mut.isPending ? '...' : 'حفظ التعديلات'}
        </button>
      </form>
    </section>
  )
}

function AddNoteForm({ prescriptionId, onDone }: { prescriptionId: string; onDone: () => void }) {
  const [body, setBody] = useState('')
  const mut = useMutation({
    mutationFn: () => addPrescriptionNote({ data: { prescriptionId, body } }),
    onSuccess: () => { setBody(''); onDone() },
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) mut.mutate() }} className="mt-3 flex gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="إضافة ملاحظة..."
        className="flex-1 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60">
        {mut.isPending ? '...' : 'إضافة'}
      </button>
    </form>
  )
}
