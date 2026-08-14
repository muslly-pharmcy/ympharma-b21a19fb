import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Search, ShieldAlert, UserRound, X } from 'lucide-react'
import {
  getPatientMedicationDetail,
  searchPatientRoster,
} from '@/lib/medication-vault-admin.functions'
import { SEVERITY_CLASS, SEVERITY_LABEL, screenSafety } from '@/lib/medical/interaction-engine'
import { useDebounce } from '@/shared/hooks/useDebounce'

/** Pharmacist-only clinical inspector: roster search → drawer with meds, box photos and interactions. */
export function PatientMedicationInspector() {
  const [q, setQ] = useState('')
  const search = useDebounce(q, 300)
  const [openId, setOpenId] = useState<string | null>(null)

  const roster = useQuery({
    queryKey: ['inspector-roster', search],
    queryFn: () => searchPatientRoster({ data: { q: search } }),
  })

  return (
    <section dir="rtl" className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 text-lg font-semibold">المفتّش السريري للأدوية</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        ابحث عن المريض لعرض أدويته المزمنة، صور علبه الدوائية، وفحص التداخلات.
      </p>

      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اسم المريض أو رقم الهاتف"
          className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-sm"
        />
      </div>

      {roster.isLoading && <p className="text-sm text-muted-foreground">جاري البحث…</p>}
      {roster.error && <p className="text-sm text-red-600">{(roster.error as Error).message}</p>}

      <ul className="divide-y divide-border">
        {(roster.data ?? []).map((p) => (
          <li key={p.id}>
            <button
              onClick={() => setOpenId(p.id)}
              className="flex w-full items-center gap-3 py-3 text-right hover:bg-muted/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <UserRound className="h-4 w-4 text-primary" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{p.full_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.phone ?? '—'} • {p.mrn ?? 'بدون رقم ملف'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!roster.isLoading && (roster.data ?? []).length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">لا توجد نتائج</p>
      )}

      {openId && <InspectorDrawer patientId={openId} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function InspectorDrawer({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inspector-detail', patientId],
    queryFn: () => getPatientMedicationDetail({ data: { patientId } }),
  })

  const hits = data
    ? screenSafety({
        medicines: data.medications.filter((m) => m.is_active).map((m) => m.medicine_name),
        conditions: data.conditions,
        allergies: data.allergies,
      })
    : []

  const waHref = (() => {
    if (!data?.patient.phone) return null
    const digits = data.patient.phone.replace(/[^\d]/g, '')
    if (!digits) return null
    const text = [
      `مرحباً ${data.patient.full_name}،`,
      'معك صيدلية المصلي — بخصوص مراجعة أدويتك المزمنة:',
      ...data.medications
        .filter((m) => m.is_active)
        .map((m) => `• ${m.medicine_name}${m.dose ? ` (${m.dose})` : ''} — ${m.schedule_preset}`),
      hits.length ? `⚠️ لدينا ${hits.length} ملاحظة أمان دوائية نود مناقشتها معك.` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  })()

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <button aria-label="إغلاق" className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="h-full w-full max-w-md overflow-y-auto bg-background p-5 shadow-2xl sm:w-[26rem]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{data?.patient.full_name ?? 'ملف المريض'}</h3>
          <button onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

        {data && (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold">الأدوية المزمنة</h4>
              {data.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد أدوية مسجلة.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.medications.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-xl border border-border p-2.5 text-sm ${m.is_active ? '' : 'opacity-50'}`}
                    >
                      <span className="font-medium">{m.medicine_name}</span>
                      {m.dose && <span className="text-muted-foreground"> — {m.dose}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {m.schedule_preset} • {m.times_per_day} مرة يومياً
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">صور العلب الدوائية</h4>
              {data.photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد صور مرفوعة.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {data.photos.map((p) =>
                    p.url ? (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        <img
                          src={p.url}
                          alt={p.title}
                          loading="lazy"
                          className="h-24 w-full rounded-lg object-cover"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> فحص التداخلات
              </h4>
              {hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد تداخلات مكتشفة.</p>
              ) : (
                <ul className="space-y-2">
                  {hits.map((h, i) => (
                    <li key={i} className={`rounded-xl border p-3 text-sm ${SEVERITY_CLASS[h.severity]}`}>
                      <p className="font-semibold">
                        {SEVERITY_LABEL[h.severity]} — {h.title}
                      </p>
                      <p>{h.detail}</p>
                      <p className="mt-1 text-xs opacity-80">{h.advice}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                <MessageCircle className="h-4 w-4" /> استشارة عبر واتساب
              </a>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}

export default PatientMedicationInspector
