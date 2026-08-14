import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Pill, ShieldAlert, Trash2, UserRound } from 'lucide-react'
import { FamilyHealthProfile } from '@/components/account/FamilyHealthProfile'
import { BarcodeScanButton } from '@/shared/components/BarcodeScanButton'
import { RefillReminderCard } from '@/components/store/RefillReminderCard'
import { supabase } from '@/integrations/supabase/client'
import {
  SCHEDULE_PRESETS,
  type SchedulePreset,
  createVaultUploadUrl,
  deleteChronicMedication,
  deleteVaultBoxPhoto,
  listChronicMedications,
  listVaultBoxPhotos,
  registerVaultBoxPhoto,
  saveChronicMedication,
} from '@/lib/medication-vault.functions'
import { SEVERITY_CLASS, SEVERITY_LABEL, screenSafety } from '@/lib/medical/interaction-engine'

export const Route = createFileRoute('/_authenticated/patient-profile')({
  head: () => ({
    meta: [
      { title: 'ملفي الصحي وخزينة الأدوية | صيدلية المصلي' },
      {
        name: 'description',
        content:
          'أدر ملفك الصحي، احفظ صور علب أدويتك في خزينة آمنة، ونظّم أدويتك المزمنة بمواعيدها مع فحص تلقائي للتداخلات الدوائية.',
      },
      { property: 'og:title', content: 'ملفي الصحي وخزينة الأدوية | صيدلية المصلي' },
      {
        property: 'og:description',
        content: 'خزينة صور العلب الدوائية ومدير الأدوية المزمنة مع تنبيهات أمان فورية.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: PatientProfileRoute,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-red-600" dir="rtl">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">الصفحة غير موجودة</div>,
})

type TabKey = 'profile' | 'vault' | 'meds'

const TABS: Array<{ key: TabKey; label: string; icon: typeof UserRound }> = [
  { key: 'profile', label: 'الملف الصحي', icon: UserRound },
  { key: 'vault', label: 'خزينة الأدوية والعلب', icon: Camera },
  { key: 'meds', label: 'الأدوية المزمنة', icon: Pill },
]

function PatientProfileRoute() {
  const [tab, setTab] = useState<TabKey>('profile')
  const { isFlagEnabled } = useFeatureFlags()
  const vaultEnabled = isFlagEnabled('enable_medication_vault')
  const visibleTabs = vaultEnabled ? TABS : TABS.filter((t) => t.key === 'profile')
  const activeTab: TabKey = vaultEnabled ? tab : 'profile'

  return (
    <main dir="rtl" className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate text-2xl font-bold">ملفي الصحي</h1>
        <BarcodeScanButton className="shrink-0" />
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        بياناتك مشفّرة وخاصة بك وحدك، ويطّلع عليها الصيدلي فقط عند المراجعة السريرية.
      </p>

      {!vaultEnabled && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          خزينة الأدوية والعلب متوقفة مؤقتًا من إدارة الصيدلية. بياناتك المحفوظة آمنة وستعود عند
          إعادة التفعيل.
        </p>
      )}

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              activeTab === key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && <FamilyHealthProfile />}
      {activeTab === 'vault' && <VaultTab />}
      {activeTab === 'meds' && <MedicationsTab />}

    </main>
  )
}

/* ------------------------------- Vault tab ------------------------------- */

async function downscale(file: File): Promise<Blob> {
  if (typeof document === 'undefined') return file
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const max = 1280
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.82),
  )
  return blob ?? file
}

function VaultTab() {
  const qc = useQueryClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['vault-boxes'],
    queryFn: () => listVaultBoxPhotos(),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const blob = await downscale(file)
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const signed = await createVaultUploadUrl({ data: { extension: ext } })
      const up = await supabase.storage
        .from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, blob, { contentType: blob.type })
      if (up.error) throw new Error(up.error.message)
      await registerVaultBoxPhoto({
        data: {
          path: signed.path,
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'علبة دواء',
          sizeBytes: blob.size,
          mimeType: blob.type,
        },
      })
    },
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['vault-boxes'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteVaultBoxPhoto({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vault-boxes'] }),
  })

  const pick = (input: HTMLInputElement | null) => input?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) upload.mutate(file)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 text-lg font-semibold">خزينة الأدوية والعلب</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        صوّر علبة الدواء ليتعرّف عليها الصيدلي بسرعة عند الطلب أو الاستشارة.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => pick(cameraRef.current)}
          disabled={upload.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          تصوير العلبة
        </button>
        <button
          onClick={() => pick(fileRef.current)}
          disabled={upload.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-60"
        >
          <ImagePlus className="h-4 w-4" />
          رفع صورة
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onFile}
        />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
      {!isLoading && photos.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          لا توجد صور بعد — ابدأ بتصوير أول علبة دواء.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-xl border border-border bg-muted">
            {p.url ? (
              <img
                src={p.url}
                alt={p.title}
                loading="lazy"
                className="h-32 w-full object-cover"
              />
            ) : (
              <div className="h-32 w-full animate-pulse bg-muted" />
            )}
            <figcaption className="flex items-center justify-between gap-2 p-2 text-xs">
              <span className="truncate">{p.title}</span>
              <button
                onClick={() => remove.mutate(p.id)}
                aria-label="حذف الصورة"
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

/* ---------------------------- Medications tab ---------------------------- */

function MedicationsTab() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [preset, setPreset] = useState<SchedulePreset>('يومياً')
  const [times, setTimes] = useState(1)

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ['chronic-meds'],
    queryFn: () => listChronicMedications(),
  })

  const save = useMutation({
    mutationFn: () =>
      saveChronicMedication({
        data: {
          medicineName: name,
          dose: dose || null,
          schedulePreset: preset,
          timesPerDay: times,
          startDate: null,
          notes: null,
          isActive: true,
        },
      }),
    onSuccess: () => {
      setName('')
      setDose('')
      void qc.invalidateQueries({ queryKey: ['chronic-meds'] })
    },
  })

  const toggle = useMutation({
    mutationFn: (m: { id: string; isActive: boolean; medicine_name: string; dose: string | null; schedule_preset: SchedulePreset; times_per_day: number }) =>
      saveChronicMedication({
        data: {
          id: m.id,
          medicineName: m.medicine_name,
          dose: m.dose,
          schedulePreset: m.schedule_preset,
          timesPerDay: m.times_per_day,
          startDate: null,
          notes: null,
          isActive: m.isActive,
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chronic-meds'] }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteChronicMedication({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chronic-meds'] }),
  })

  const hits = screenSafety({ medicines: meds.filter((m) => m.is_active).map((m) => m.medicine_name) })

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">إضافة دواء مزمن</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) save.mutate()
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الدواء"
              className="min-w-44 flex-1 rounded-xl border border-border bg-background p-2.5 text-sm"
            />
            <input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="الجرعة (مثال: 500 مجم)"
              className="w-44 rounded-xl border border-border bg-background p-2.5 text-sm"
            />
            <input
              type="number"
              min={1}
              max={12}
              value={times}
              onChange={(e) => setTimes(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              aria-label="عدد المرات يومياً"
              className="w-24 rounded-xl border border-border bg-background p-2.5 text-center text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  preset === p
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            disabled={save.isPending}
            className="rounded-xl bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60"
          >
            إضافة الدواء
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">أدويتي</h2>
        {isLoading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
        {!isLoading && meds.length === 0 && (
          <p className="text-sm text-muted-foreground">لم تُضف أدوية بعد.</p>
        )}
        <ul className="divide-y divide-border">
          {meds.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className={m.is_active ? '' : 'opacity-50'}>
                <p className="font-medium">
                  {m.medicine_name} {m.dose && <span className="text-sm text-muted-foreground">— {m.dose}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.schedule_preset} • {m.times_per_day} مرة يومياً
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() =>
                    toggle.mutate({
                      id: m.id,
                      isActive: !m.is_active,
                      medicine_name: m.medicine_name,
                      dose: m.dose,
                      schedule_preset: m.schedule_preset,
                      times_per_day: m.times_per_day,
                    })
                  }
                  className="rounded-lg border border-border px-3 py-1 text-xs"
                >
                  {m.is_active ? 'إيقاف' : 'تفعيل'}
                </button>
                <button onClick={() => remove.mutate(m.id)} aria-label="حذف" className="text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {hits.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-800">
            <ShieldAlert className="h-5 w-5" /> تنبيهات أمان دوائية
          </h2>
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
        </div>
      )}

      <RefillReminderCard />
    </section>
  )
}
