import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FileText, Plus, ArrowLeft } from 'lucide-react'
import { listPrescriptions } from '@/lib/prescriptions.functions'
import { listPatients } from '@/lib/patients.functions'
import { createPrescription } from '@/lib/prescriptions.mutations.functions'
import { getMyOrganization } from '@/lib/me.functions'

export const Route = createFileRoute('/_authenticated/prescriptions')({
  head: () => ({ meta: [{ title: 'الوصفات الطبية — MUSLLY AI OS' }] }),
  component: PrescriptionsListPage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
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

function PrescriptionsListPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['prescriptions', statusFilter, search],
    queryFn: () => listPrescriptions({ data: {
      status: statusFilter || undefined, search: search || undefined, limit: 100,
    } }),
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="glass-panel flex items-center justify-between rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الوصفات الطبية</h1>
            <p className="text-sm text-muted-foreground">إدارة دورة حياة الوصفة الطبية</p>
          </div>
        </div>
        <button onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> {showCreate ? 'إخفاء' : 'وصفة جديدة'}
        </button>
      </header>

      {showCreate && <CreateForm onCreated={() => { setShowCreate(false); void refetch() }} />}

      <section className="glass-panel rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الوصفة أو التشخيص"
            className="flex-1 min-w-40 rounded-lg border border-gray-200 p-2 text-sm text-right" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 p-2 text-sm">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </section>

      <section className="glass-panel rounded-2xl">
        {isFetching && !data ? (
          <p className="p-8 text-center">جاري التحميل...</p>
        ) : (data?.prescriptions.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-muted-foreground">لا توجد وصفات</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data!.prescriptions.map((rx) => (
              <li key={rx.id}>
                <Link to="/prescriptions/$prescriptionId" params={{ prescriptionId: rx.id }}
                  className="flex items-center justify-between p-4 hover:bg-primary/5">
                  <div>
                    <p className="font-medium">
                      {rx.prescription_no ?? rx.id.slice(0, 8)}
                      {rx.patient && <span className="text-muted-foreground"> • {rx.patient.full_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rx.doctor?.full_name_ar ?? rx.external_doctor_name ?? 'بدون طبيب'} •{' '}
                      {new Date(rx.issued_at).toLocaleDateString('ar')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs ${STATUS_COLOR[rx.status] ?? 'bg-gray-100'}`}>
                      {STATUS_LABEL[rx.status] ?? rx.status}
                    </span>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const qc = useQueryClient()
  const { data: org } = useQuery({ queryKey: ['me'], queryFn: () => getMyOrganization() })
  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: () => listPatients() })

  const [patient_id, setPatient] = useState('')
  const [external_doctor_name, setExtDoc] = useState('')
  const [prescription_no, setNo] = useState('')
  const [diagnosis, setDiag] = useState('')

  const mut = useMutation({
    mutationFn: () => createPrescription({ data: {
      organizationId: org!.organizationId,
      patient_id,
      external_doctor_name: external_doctor_name || null,
      prescription_no: prescription_no || null,
      diagnosis: diagnosis || null,
      items: [],
    } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['prescriptions'] }); onCreated() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (org && patient_id) mut.mutate() }}
      className="glass-panel grid gap-3 rounded-2xl p-6 sm:grid-cols-2">
      <select value={patient_id} onChange={(e) => setPatient(e.target.value)} required
        className="rounded-lg border border-gray-200 p-2 text-sm text-right">
        <option value="">اختر المريض *</option>
        {(patients ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name} • {p.mrn ?? ''}</option>)}
      </select>
      <input value={prescription_no} onChange={(e) => setNo(e.target.value)} placeholder="رقم الوصفة"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={external_doctor_name} onChange={(e) => setExtDoc(e.target.value)} placeholder="اسم الطبيب (خارجي)"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right sm:col-span-2" />
      <textarea value={diagnosis} onChange={(e) => setDiag(e.target.value)} placeholder="التشخيص"
        rows={2} className="rounded-lg border border-gray-200 p-2 text-sm text-right sm:col-span-2" />
      {mut.error && <p className="text-sm text-red-600 sm:col-span-2">{(mut.error as Error).message}</p>}
      <button disabled={mut.isPending || !org} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60 sm:col-span-2">
        {mut.isPending ? '...' : 'إنشاء الوصفة (مسودة)'}
      </button>
    </form>
  )
}
