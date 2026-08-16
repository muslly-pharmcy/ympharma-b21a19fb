import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { PHARMACY } from '@/shared/branding'
import { submitPrescriptionUpload, logWidgetEvent } from '@/lib/store-requests.functions'

const MAX_MB = 6

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'))
    reader.readAsDataURL(file)
  })
}

/** Prescription photo upload → saved request + 1-click WhatsApp order payload. */
export function PrescriptionUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [waUrl, setWaUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = useServerFn(submitPrescriptionUpload)
  const logEvent = useServerFn(logWidgetEvent)

  const pick = async (f: File | null) => {
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`حجم الملف يتجاوز ${MAX_MB} ميجابايت`)
      return
    }
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!fullName.trim() || !phone.trim()) {
      toast.error('الاسم ورقم الهاتف مطلوبان')
      return
    }
    setBusy(true)
    try {
      const fileData = file ? await readAsDataUrl(file) : undefined
      const res = await submit({
        data: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
          fileName: file?.name,
          fileData,
        },
      })
      const message = [
        `مرحباً ${PHARMACY.nameAr}، أرغب في تجهيز وصفتي الطبية.`,
        `الاسم: ${fullName.trim()}`,
        `الهاتف: ${phone.trim()}`,
        notes.trim() ? `ملاحظات: ${notes.trim()}` : null,
        res.signedUrl ? `صورة الوصفة: ${res.signedUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n')
      setWaUrl(`${PHARMACY.whatsappUrl}?text=${encodeURIComponent(message)}`)
      void logEvent({ data: { kind: 'rx_modal_open' } }).catch(() => {})
      toast.success('تم استلام وصفتك — سنتواصل معك قريباً')
    } catch (err) {
      toast.error((err as Error).message || 'تعذّر إرسال الوصفة')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setWaUrl(null)
    setFile(null)
    setPreview(null)
    setNotes('')
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
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center"
          onClick={reset}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/40 p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-foreground">رفع الوصفة الطبية</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  صوّر وصفتك وسيجهّزها الصيدلي ويتواصل معك عبر واتساب.
                </p>
              </div>
              <button onClick={reset} aria-label="إغلاق" className="rounded-xl p-1.5 text-muted-foreground hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            {waUrl ? (
              <div className="space-y-4 py-4 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <p className="text-sm font-semibold text-foreground">تم استلام وصفتك بنجاح</p>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-scale inline-flex items-center justify-center rounded-2xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-lg"
                >
                  إكمال الطلب عبر واتساب
                </a>
                <button onClick={reset} className="block w-full text-xs text-muted-foreground hover:underline">
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-primary transition hover:bg-primary/10"
                >
                  {preview ? (
                    <img src={preview} alt="معاينة الوصفة" className="max-h-40 rounded-xl object-contain" />
                  ) : (
                    <Camera className="h-8 w-8" />
                  )}
                  <span className="text-sm font-bold">
                    {file ? file.name : 'التقاط صورة أو اختيار ملف'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">JPG · PNG · PDF — حتى {MAX_MB}MB</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => void pick(e.target.files?.[0] ?? null)}
                />

                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="الاسم الكامل"
                  aria-label="الاسم الكامل"
                  className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="رقم الهاتف / واتساب"
                  inputMode="tel"
                  aria-label="رقم الهاتف"
                  className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات (اختياري): العنوان، وقت التوصيل، بدائل مقبولة…"
                  rows={3}
                  aria-label="ملاحظات"
                  className="w-full rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-primary"
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="press-scale flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  إرسال الوصفة
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  بياناتك تُحفظ بشكل خاص ولا تظهر إلا لفريق الصيدلية.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
