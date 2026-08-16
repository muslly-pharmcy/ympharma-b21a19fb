import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { UserRound, Plus, Search } from 'lucide-react'
import { listPatients } from '@/lib/patients.functions'
import { createPatient } from '@/lib/patients.mutations.functions'
import { getMyOrganization } from '@/lib/me.functions'

export const Route = createFileRoute('/_authenticated/patients')({
  head: () => ({
    meta: [
      { title: 'المرضى — MUSLLY AI OS' },
      { name: 'description', content: 'إدارة سجلات المرضى داخل المؤسسة.' },
    ],
  }),
  component: PatientsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">فشل التحميل: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function PatientsPage() {
  const router = useRouter()
  const { data: me } = useQuery({ queryKey: ['me', 'org'], queryFn: () => getMyOrganization() })
  const organizationId = me?.organizationId ?? null
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: patients = [], refetch, isFetching } = useQuery({
    queryKey: ['patients', 'list'],
    queryFn: () => listPatients(),
  })

  const filtered = patients.filter((p) => {
    if (!q.trim()) return true
    const needle = q.toLowerCase()
    return (
      p.full_name.toLowerCase().includes(needle) ||
      (p.mrn ?? '').toLowerCase().includes(needle) ||
      (p.phone ?? '').includes(needle)
    )
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المرضى</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length.toLocaleString('ar-EG')} سجل نشط
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-white shadow-lg shadow-primary/25"
        >
          <Plus className="h-4 w-4" />
          مريض جديد
        </button>
      </header>

      {showNew && organizationId && (
        <NewPatientForm
          organizationId={organizationId}
          onDone={() => {
            setShowNew(false)
            void refetch()
            router.invalidate()
          }}
        />
      )}

      <div className="glass-panel flex items-center gap-3 rounded-2xl p-4">
        <Search className="h-5 w-5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم، MRN، أو الهاتف..."
          className="flex-1 bg-transparent text-right outline-none"
        />
      </div>

      {isFetching && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}

      {filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <UserRound className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا يوجد مرضى مطابقون</p>
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-gray-100 rounded-2xl">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                to="/patients/$patientId"
                params={{ patientId: p.id }}
                className="flex items-center gap-3 p-4 hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.mrn ?? '—'} • {p.phone ?? 'بدون هاتف'}
                  </p>
                </div>
                {p.blood_type && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                    {p.blood_type}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewPatientForm({ organizationId, onDone }: { organizationId: string; onDone: () => void }) {
  const [full_name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState<'' | 'male' | 'female' | 'other'>('')
  const [date_of_birth, setDob] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      createPatient({
        data: {
          organizationId,
          full_name,
          phone: phone || null,
          email: email || null,
          date_of_birth: date_of_birth || null,
          gender: gender || null,
          metadata: {},
          idempotencyKey: `create-patient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      }),
    onSuccess: () => onDone(),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!full_name.trim()) return
        mut.mutate()
      }}
      className="glass-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2"
    >
      <input required value={full_name} onChange={(e) => setName(e.target.value)}
        placeholder="الاسم الكامل *" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)}
        placeholder="الهاتف" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="البريد الإلكتروني" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <input type="date" value={date_of_birth} onChange={(e) => setDob(e.target.value)}
        className="rounded-xl border border-gray-200 bg-white p-2.5" />
      <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}
        className="rounded-xl border border-gray-200 bg-white p-2.5">
        <option value="">النوع (اختياري)</option>
        <option value="male">ذكر</option>
        <option value="female">أنثى</option>
        <option value="other">آخر</option>
      </select>
      <button disabled={mut.isPending} type="submit"
        className="rounded-xl bg-primary px-4 py-2.5 font-medium text-white disabled:opacity-60 sm:col-span-2">
        {mut.isPending ? 'جاري الحفظ...' : 'حفظ المريض'}
      </button>
      {mut.error && <p className="text-sm text-red-600 sm:col-span-2">{(mut.error as Error).message}</p>}
    </form>
  )
}
