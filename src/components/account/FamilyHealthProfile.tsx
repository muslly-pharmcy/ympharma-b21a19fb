import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServerFn } from '@tanstack/react-start'
import { motion } from 'framer-motion'
import { HeartPulse, Plus, Trash2, Loader2, Star, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  listFamilyProfiles,
  saveFamilyProfile,
  deleteFamilyProfile,
  type FamilyProfile,
} from '@/lib/family-health.functions'

const RELATIONS = ['نفسي', 'الزوج/الزوجة', 'ابن', 'ابنة', 'الأب', 'الأم', 'أخرى']
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const emptyDraft = {
  displayName: '',
  relation: 'نفسي',
  birthDate: '',
  weightKg: '',
  bloodType: '',
  allergies: '',
  chronicConditions: '',
  currentMedicines: '',
  notes: '',
  isDefault: false,
}

const toList = (v: string) =>
  v
    .split(/[,،\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)

/** Family digital health wallet — sub-profiles used for cart safety screening. */
export function FamilyHealthProfile() {
  const qc = useQueryClient()
  const list = useServerFn(listFamilyProfiles)
  const save = useServerFn(saveFamilyProfile)
  const remove = useServerFn(deleteFamilyProfile)

  const [draft, setDraft] = useState({ ...emptyDraft })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const profiles = useQuery({ queryKey: ['family-profiles'], queryFn: () => list() })

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(editingId ? { id: editingId } : {}),
          displayName: draft.displayName.trim(),
          relation: draft.relation,
          birthDate: draft.birthDate || null,
          weightKg: draft.weightKg ? Number(draft.weightKg) : null,
          bloodType: draft.bloodType || null,
          allergies: toList(draft.allergies),
          chronicConditions: toList(draft.chronicConditions),
          currentMedicines: toList(draft.currentMedicines),
          notes: draft.notes || null,
          isDefault: draft.isDefault,
        },
      }),
    onSuccess: () => {
      toast.success('تم حفظ الملف الصحي')
      setDraft({ ...emptyDraft })
      setEditingId(null)
      setShowForm(false)
      void qc.invalidateQueries({ queryKey: ['family-profiles'] })
    },
    onError: (e: Error) => toast.error(e.message || 'تعذّر الحفظ'),
  })

  const deleting = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success('تم الحذف')
      void qc.invalidateQueries({ queryKey: ['family-profiles'] })
    },
    onError: (e: Error) => toast.error(e.message || 'تعذّر الحذف'),
  })

  const startEdit = (p: FamilyProfile) => {
    setEditingId(p.id)
    setShowForm(true)
    setDraft({
      displayName: p.display_name,
      relation: p.relation,
      birthDate: p.birth_date ?? '',
      weightKg: p.weight_kg != null ? String(p.weight_kg) : '',
      bloodType: p.blood_type ?? '',
      allergies: p.allergies.join('، '),
      chronicConditions: p.chronic_conditions.join('، '),
      currentMedicines: p.current_medicines.join('، '),
      notes: p.notes ?? '',
      isDefault: p.is_default,
    })
  }

  const field = 'w-full rounded-2xl border border-white/50 bg-white/80 p-3 text-sm outline-none focus:border-primary/50 dark:bg-slate-900/60'

  return (
    <section dir="rtl" className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
            <HeartPulse className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-foreground">المحفظة الصحية للعائلة</h2>
            <p className="text-[11px] text-muted-foreground">
              الحساسيات والأمراض المزمنة تُستخدم للتحقق من أمان طلباتك تلقائياً.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setDraft({ ...emptyDraft })
            setShowForm((v) => !v)
          }}
          className="press-scale inline-flex items-center gap-1 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> ملف جديد
        </button>
      </header>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card space-y-3 rounded-3xl border border-white/40 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              placeholder="الاسم *"
              value={draft.displayName}
              onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
            />
            <select
              className={field}
              value={draft.relation}
              onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
            >
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              className={field}
              type="date"
              value={draft.birthDate}
              onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
            />
            <input
              className={field}
              inputMode="decimal"
              placeholder="الوزن (كجم)"
              value={draft.weightKg}
              onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })}
            />
            <select
              className={field}
              value={draft.bloodType}
              onChange={(e) => setDraft({ ...draft, bloodType: e.target.value })}
            >
              <option value="">فصيلة الدم</option>
              {BLOOD_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/80 p-3 text-sm dark:bg-slate-900/60">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
              />
              الملف الافتراضي للطلبات
            </label>
          </div>
          <textarea
            className={field}
            rows={2}
            placeholder="الحساسيات (افصل بفاصلة): بنسلين، أسبرين"
            value={draft.allergies}
            onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
          />
          <textarea
            className={field}
            rows={2}
            placeholder="الأمراض المزمنة: سكري، ضغط، ربو"
            value={draft.chronicConditions}
            onChange={(e) => setDraft({ ...draft, chronicConditions: e.target.value })}
          />
          <textarea
            className={field}
            rows={2}
            placeholder="الأدوية الحالية: ميتفورمين، وارفارين"
            value={draft.currentMedicines}
            onChange={(e) => setDraft({ ...draft, currentMedicines: e.target.value })}
          />
          <textarea
            className={field}
            rows={2}
            placeholder="ملاحظات إضافية"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
          <button
            type="button"
            disabled={saving.isPending}
            onClick={() => saving.mutate()}
            className="press-scale flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground disabled:opacity-60"
          >
            {saving.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الملف الصحي
          </button>
        </motion.div>
      )}

      {profiles.isLoading ? (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (profiles.data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/50 p-6 text-center text-sm text-muted-foreground">
          لا توجد ملفات صحية بعد — أضف ملفك وملفات أفراد أسرتك للحصول على تنبيهات أمان دقيقة.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {profiles.data?.map((p) => (
            <li key={p.id} className="glass-card rounded-3xl border border-white/40 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-black text-foreground">
                    {p.display_name}
                    {p.is_default && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.relation}
                    {p.blood_type ? ` · ${p.blood_type}` : ''}
                    {p.weight_kg ? ` · ${p.weight_kg} كجم` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-xl px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/10"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => deleting.mutate(p.id)}
                    aria-label="حذف"
                    className="rounded-xl p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {p.allergies.length > 0 && <p>الحساسيات: {p.allergies.join('، ')}</p>}
                {p.chronic_conditions.length > 0 && <p>الأمراض المزمنة: {p.chronic_conditions.join('، ')}</p>}
                {p.current_medicines.length > 0 && <p>الأدوية الحالية: {p.current_medicines.join('، ')}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default FamilyHealthProfile
