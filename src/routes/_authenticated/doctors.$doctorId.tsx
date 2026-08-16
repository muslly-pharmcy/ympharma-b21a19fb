import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Stethoscope, ArrowRight, BadgeCheck } from 'lucide-react'
import { getDoctor } from '@/lib/doctors.functions'
import { addLicense } from '@/lib/doctors.mutations.functions'

export const Route = createFileRoute('/_authenticated/doctors/$doctorId')({
  head: () => ({ meta: [{ title: 'ملف الطبيب — MUSLLY AI OS' }] }),
  component: DoctorProfilePage,
  errorComponent: ({ error }) => <div className="p-8 text-center text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center">الطبيب غير موجود</div>,
})

function DoctorProfilePage() {
  const { doctorId } = Route.useParams()
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => getDoctor({ data: { id: doctorId } }),
  })

  if (isFetching && !data) return <div className="p-8">جاري التحميل...</div>
  if (!data) return <div className="p-8 text-center">الطبيب غير موجود</div>

  const { doctor, licenses } = data

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link to="/doctors" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-4 w-4" /> عودة للقائمة
      </Link>

      <header className="glass-panel flex items-center gap-4 rounded-2xl p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Stethoscope className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{doctor.title ?? ''} {doctor.full_name_ar}</h1>
          <p className="text-sm text-muted-foreground">{doctor.full_name_en ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {doctor.years_experience ?? 0} سنة خبرة • {(doctor.languages ?? []).join(', ') || '—'}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">
          {doctor.verification_status ?? 'pending'}
        </span>
      </header>

      {doctor.bio_ar && (
        <section className="glass-panel rounded-2xl p-6">
          <h2 className="mb-2 text-lg font-semibold">السيرة</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{doctor.bio_ar}</p>
        </section>
      )}

      <section className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <BadgeCheck className="h-5 w-5 text-green-600" />
          التراخيص
        </h2>
        {licenses.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد تراخيص مسجلة</p>
        ) : (
          <div>
            {licenses.map((l) => (
              <div key={l.id} className="flex items-center justify-between border-b border-gray-100 py-3">
                <div>
                  <p className="font-medium">{l.license_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.authority ?? '—'} • {l.country ?? '—'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-3 py-1 text-xs ${
                    l.status === 'active' ? 'bg-green-100 text-green-700' :
                    l.status === 'expired' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{l.status}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    ينتهي {l.valid_to ?? '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <LicenseForm doctorId={doctorId} onSaved={() => void refetch()} />
        </div>
      </section>
    </div>
  )
}

function LicenseForm({ doctorId, onSaved }: { doctorId: string; onSaved: () => void }) {
  const [license_number, setNum] = useState('')
  const [authority, setAuth] = useState('')
  const [country, setCountry] = useState('')
  const [valid_to, setValidTo] = useState('')

  const mut = useMutation({
    mutationFn: () => addLicense({ data: {
      doctorId, license_number,
      authority: authority || null,
      country: country || null,
      valid_from: null,
      valid_to: valid_to || null,
      document_url: null,
    } }),
    onSuccess: () => { setNum(''); setAuth(''); setCountry(''); setValidTo(''); onSaved() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (license_number.trim()) mut.mutate() }}
      className="grid gap-2 sm:grid-cols-4">
      <input value={license_number} onChange={(e) => setNum(e.target.value)} placeholder="رقم الترخيص *"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" required />
      <input value={authority} onChange={(e) => setAuth(e.target.value)} placeholder="الجهة"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="الدولة"
        className="rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input type="date" value={valid_to} onChange={(e) => setValidTo(e.target.value)}
        className="rounded-lg border border-gray-200 p-2 text-sm" />
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60 sm:col-span-4">
        {mut.isPending ? '...' : 'إضافة ترخيص'}
      </button>
    </form>
  )
}
