import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Stethoscope, Plus, Search } from 'lucide-react'
import { listDoctors } from '@/lib/doctors.functions'
import { createDoctor } from '@/lib/doctors.mutations.functions'
import { getMyOrganization } from '@/lib/me.functions'

export const Route = createFileRoute('/_authenticated/doctors')({
  head: () => ({
    meta: [
      { title: 'الأطباء — MUSLLY AI OS' },
      { name: 'description', content: 'إدارة سجلات الأطباء داخل المؤسسة.' },
    ],
  }),
  component: DoctorsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">غير موجود</div>,
})

function DoctorsPage() {
  const router = useRouter()
  const { data: me } = useQuery({ queryKey: ['me', 'org'], queryFn: () => getMyOrganization() })
  const organizationId = me?.organizationId ?? null
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)

  const { data: doctors = [], refetch, isFetching } = useQuery({
    queryKey: ['doctors', 'list'],
    queryFn: () => listDoctors(),
  })

  const filtered = doctors.filter((d) => {
    if (!q.trim()) return true
    const n = q.toLowerCase()
    return (
      d.full_name_ar.toLowerCase().includes(n) ||
      (d.full_name_en ?? '').toLowerCase().includes(n)
    )
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الأطباء</h1>
          <p className="text-sm text-muted-foreground">
            {doctors.length.toLocaleString('ar-EG')} طبيب
          </p>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-white shadow-lg shadow-primary/25"
        >
          <Plus className="h-4 w-4" />
          طبيب جديد
        </button>
      </header>

      {showNew && organizationId && (
        <NewDoctorForm
          organizationId={organizationId}
          onDone={() => { setShowNew(false); void refetch(); router.invalidate() }}
        />
      )}

      <div className="glass-panel flex items-center gap-3 rounded-2xl p-4">
        <Search className="h-5 w-5 text-gray-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم..." className="flex-1 bg-transparent text-right outline-none" />
      </div>

      {isFetching && <p className="text-sm text-muted-foreground">جاري التحميل...</p>}

      {filtered.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
          <Stethoscope className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium">لا يوجد أطباء</p>
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-gray-100 rounded-2xl">
          {filtered.map((d) => (
            <li key={d.id}>
              <Link to="/doctors/$doctorId" params={{ doctorId: d.id }}
                className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{d.title ?? ''} {d.full_name_ar}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.full_name_en ?? '—'} • {d.years_experience ?? 0} سنة خبرة
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {d.verification_status ?? 'pending'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewDoctorForm({ organizationId, onDone }: { organizationId: string; onDone: () => void }) {
  const [full_name_ar, setAr] = useState('')
  const [full_name_en, setEn] = useState('')
  const [title, setTitle] = useState('د.')
  const [years, setYears] = useState('')

  const mut = useMutation({
    mutationFn: () => createDoctor({ data: {
      organizationId,
      full_name_ar,
      full_name_en: full_name_en || null,
      title: title || null,
      years_experience: years ? Number(years) : null,
      languages: ['ar'],
      idempotencyKey: `create-doctor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    } }),
    onSuccess: () => onDone(),
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (full_name_ar.trim()) mut.mutate() }}
      className="glass-panel grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
      <input required value={full_name_ar} onChange={(e) => setAr(e.target.value)}
        placeholder="الاسم بالعربية *" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <input value={full_name_en} onChange={(e) => setEn(e.target.value)}
        placeholder="Name (English)" className="rounded-xl border border-gray-200 bg-white p-2.5" />
      <input value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="اللقب (د. / أ.د.)" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <input type="number" min="0" value={years} onChange={(e) => setYears(e.target.value)}
        placeholder="سنوات الخبرة" className="rounded-xl border border-gray-200 bg-white p-2.5 text-right" />
      <button disabled={mut.isPending} className="rounded-xl bg-primary px-4 py-2.5 font-medium text-white disabled:opacity-60 sm:col-span-2">
        {mut.isPending ? 'جاري الحفظ...' : 'حفظ الطبيب'}
      </button>
      {mut.error && <p className="text-sm text-red-600 sm:col-span-2">{(mut.error as Error).message}</p>}
    </form>
  )
}
