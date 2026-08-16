import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { UserRound, ArrowRight, AlertTriangle, Activity, Phone } from 'lucide-react'
import { getPatient } from '@/lib/patients.functions'
import { addAllergy, addCondition, addEmergencyContact } from '@/lib/patients.mutations.functions'

export const Route = createFileRoute('/_authenticated/patients/$patientId')({
  head: () => ({
    meta: [{ title: 'ملف المريض — MUSLLY AI OS' }],
  }),
  component: PatientProfilePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">المريض غير موجود</div>,
})

function PatientProfilePage() {
  const { patientId } = Route.useParams()
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => getPatient({ data: { id: patientId } }),
  })

  if (isFetching && !data) return <div className="p-8">جاري التحميل...</div>
  if (!data) return <div className="p-8 text-center">المريض غير موجود</div>

  const { patient, allergies, conditions, emergencyContacts } = data
  const onSaved = () => void refetch()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-primary">
        <ArrowRight className="h-4 w-4" /> عودة للقائمة
      </Link>

      <header className="glass-panel flex items-center gap-4 rounded-2xl p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <UserRound className="h-8 w-8 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{patient.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {patient.mrn ?? '—'} • {patient.gender ?? 'غير محدد'} •{' '}
            {patient.date_of_birth ?? 'تاريخ ميلاد غير مسجل'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {patient.phone ?? '—'} • {patient.email ?? '—'}
          </p>
        </div>
        {patient.blood_type && (
          <span className="rounded-full bg-red-50 px-4 py-2 text-lg font-bold text-red-700">
            {patient.blood_type}
          </span>
        )}
      </header>

      <Section
        title="الحساسيات"
        icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
        empty="لا توجد حساسيات مسجلة"
        items={allergies.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b border-gray-100 py-3">
            <div>
              <p className="font-medium">{a.allergen}</p>
              <p className="text-xs text-muted-foreground">{a.reaction ?? '—'}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${
              a.severity === 'life_threatening' ? 'bg-red-100 text-red-700' :
              a.severity === 'severe' ? 'bg-orange-100 text-orange-700' :
              a.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {a.severity}
            </span>
          </div>
        ))}
        form={<AllergyForm patientId={patientId} onSaved={onSaved} />}
      />

      <Section
        title="الأمراض المزمنة / الحالات"
        icon={<Activity className="h-5 w-5 text-blue-600" />}
        empty="لا توجد حالات مسجلة"
        items={conditions.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-gray-100 py-3">
            <div>
              <p className="font-medium">{c.condition_name}</p>
              <p className="text-xs text-muted-foreground">
                {c.icd10 ?? '—'} • بدأ {c.onset_date ?? '—'}
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{c.status}</span>
          </div>
        ))}
        form={<ConditionForm patientId={patientId} onSaved={onSaved} />}
      />

      <Section
        title="جهات اتصال الطوارئ"
        icon={<Phone className="h-5 w-5 text-green-600" />}
        empty="لا توجد جهات اتصال طوارئ"
        items={emergencyContacts.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b border-gray-100 py-3">
            <div>
              <p className="font-medium">{e.name} {e.is_primary && <span className="text-xs text-primary">(رئيسي)</span>}</p>
              <p className="text-xs text-muted-foreground">{e.relation ?? '—'}</p>
            </div>
            <span className="font-mono text-sm">{e.phone}</span>
          </div>
        ))}
        form={<EmergencyForm patientId={patientId} onSaved={onSaved} />}
      />
    </div>
  )
}

function Section({ title, icon, empty, items, form }: {
  title: string; icon: React.ReactNode; empty: string; items: React.ReactNode[]; form: React.ReactNode
}) {
  return (
    <section className="glass-panel rounded-2xl p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>
      {items.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p> : <div>{items}</div>}
      <div className="mt-4">{form}</div>
    </section>
  )
}

function AllergyForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [allergen, setAllergen] = useState('')
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe' | 'life_threatening'>('moderate')
  const mut = useMutation({
    mutationFn: () => addAllergy({ data: { patientId, allergen, severity, reaction: null, notes: null } }),
    onSuccess: () => { setAllergen(''); onSaved() },
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (allergen.trim()) mut.mutate() }} className="flex flex-wrap gap-2">
      <input value={allergen} onChange={(e) => setAllergen(e.target.value)} placeholder="مسبب الحساسية"
        className="flex-1 min-w-40 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}
        className="rounded-lg border border-gray-200 p-2 text-sm">
        <option value="mild">خفيفة</option>
        <option value="moderate">متوسطة</option>
        <option value="severe">شديدة</option>
        <option value="life_threatening">مهددة للحياة</option>
      </select>
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60">
        إضافة
      </button>
    </form>
  )
}

function ConditionForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [condition_name, setName] = useState('')
  const [icd10, setIcd] = useState('')
  const mut = useMutation({
    mutationFn: () => addCondition({ data: {
      patientId, condition_name, icd10: icd10 || null, status: 'active', onset_date: null, notes: null,
    } }),
    onSuccess: () => { setName(''); setIcd(''); onSaved() },
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (condition_name.trim()) mut.mutate() }} className="flex flex-wrap gap-2">
      <input value={condition_name} onChange={(e) => setName(e.target.value)} placeholder="اسم الحالة"
        className="flex-1 min-w-40 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={icd10} onChange={(e) => setIcd(e.target.value)} placeholder="ICD-10"
        className="w-28 rounded-lg border border-gray-200 p-2 text-sm text-center" />
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60">
        إضافة
      </button>
    </form>
  )
}

function EmergencyForm({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [relation, setRelation] = useState('')
  const mut = useMutation({
    mutationFn: () => addEmergencyContact({ data: { patientId, name, phone, relation: relation || null, is_primary: false } }),
    onSuccess: () => { setName(''); setPhone(''); setRelation(''); onSaved() },
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name && phone) mut.mutate() }} className="flex flex-wrap gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم"
        className="flex-1 min-w-32 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="الصلة"
        className="w-28 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف"
        className="w-40 rounded-lg border border-gray-200 p-2 text-sm text-right" />
      <button disabled={mut.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-60">
        إضافة
      </button>
    </form>
  )
}
