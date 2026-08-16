import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Siren, MapPin, Loader2, X, Send } from 'lucide-react'
import { toast } from 'sonner'
import { buildWhatsAppUrl, requestLocation } from '@/lib/store/whatsapp'

/**
 * Emergency fast-pass ordering: captures the acute medicine, patient phone and
 * (optionally) live GPS coordinates, then hands a high-priority structured
 * payload to the pharmacy's WhatsApp line.
 */
export function EmergencyOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [medicine, setMedicine] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const pickLocation = async () => {
    setLocating(true)
    const c = await requestLocation()
    setLocating(false)
    if (c) {
      setCoords(c)
      toast.success('تم تحديد موقعك بدقة')
    } else {
      toast.error('تعذّر تحديد الموقع — يمكنك كتابة العنوان في الملاحظات')
    }
  }

  const submit = () => {
    if (medicine.trim().length < 2) return toast.error('اكتب اسم الدواء المطلوب')
    if (phone.trim().length < 6) return toast.error('اكتب رقم هاتف للتواصل')
    const url = buildWhatsAppUrl({
      kind: 'emergency',
      phone: phone.trim(),
      items: medicine
        .split(/[,،\n]/)
        .map((m) => m.trim())
        .filter(Boolean)
        .map((name) => ({ name, quantity: 1 })),
      notes: notes.trim() || undefined,
      location: coords ?? undefined,
    })
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          dir="rtl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-md rounded-3xl border border-red-200/60 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500/15 text-red-600">
                  <Siren className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-foreground">وضع الطوارئ</h2>
                  <p className="text-[11px] text-muted-foreground">للأدوية العاجلة — يُعالج فوراً بأولوية قصوى.</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="إغلاق" className="rounded-xl p-1.5 text-muted-foreground hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">الدواء المطلوب *</span>
                <textarea
                  value={medicine}
                  onChange={(e) => setMedicine(e.target.value)}
                  rows={2}
                  placeholder="مثال: فنتولين بخاخ، أنسولين لانتوس"
                  className="w-full rounded-2xl border border-white/50 bg-white/80 p-3 text-sm outline-none focus:border-primary/50 dark:bg-slate-900/60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">رقم الهاتف *</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="7XXXXXXXX"
                  className="w-full rounded-2xl border border-white/50 bg-white/80 p-3 text-sm outline-none focus:border-primary/50 dark:bg-slate-900/60"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground">ملاحظات / العنوان</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="وصف الحالة أو أقرب معلم للعنوان"
                  className="w-full rounded-2xl border border-white/50 bg-white/80 p-3 text-sm outline-none focus:border-primary/50 dark:bg-slate-900/60"
                />
              </label>

              <button
                type="button"
                onClick={pickLocation}
                disabled={locating}
                className="press-scale flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary"
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {coords ? `تم تحديد الموقع (${coords.lat}, ${coords.lng})` : 'إرفاق موقعي الحالي'}
              </button>

              <button
                type="button"
                onClick={submit}
                className="press-scale flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-sm font-black text-white shadow-lg"
              >
                <Send className="h-4 w-4" /> إرسال طلب الطوارئ الآن
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                في الحالات المهدِّدة للحياة اتصل بالإسعاف فوراً قبل إرسال الطلب.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EmergencyOrderModal
