import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Loader2, ScanLine, X, ShoppingCart, FlaskConical, CheckCircle2 } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { scanPrescriptionImage, type ScanResult } from '@/lib/rx-scan.functions'
import { addToCart } from '@/lib/cart.functions'
import { buildWhatsAppUrl } from '@/lib/store/whatsapp'

const MAX_MB = 6

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('تعذّرت قراءة الملف'))
    r.readAsDataURL(file)
  })
}

/**
 * AI OCR scanner for prescriptions and lab reports: reads the photo with the
 * clinical vision model, renders an Arabic summary, and lets the patient add
 * matched catalog items straight to the cart (or order them via WhatsApp).
 */
export function AiPrescriptionScanner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'prescription' | 'lab'>('prescription')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scan = useServerFn(scanPrescriptionImage)
  const add = useServerFn(addToCart)

  const scanning = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`حجم الصورة يتجاوز ${MAX_MB}MB`)
      const imageData = await readAsDataUrl(file)
      setPreview(imageData)
      return scan({ data: { imageData, mode } })
    },
    onSuccess: (r) => {
      setResult(r)
      if (!r.ok) toast.error(r.message ?? 'تعذّرت القراءة')
    },
    onError: (e: Error) => toast.error(e.message || 'تعذّرت قراءة الصورة'),
  })

  const adding = useMutation({
    mutationFn: (productId: string) => add({ data: { productId, quantity: 1 } }),
    onSuccess: () => toast.success('أُضيف إلى السلة'),
    onError: (e: Error) => toast.error(e.message || 'تعذّرت الإضافة — قد يتطلب المنتج وصفة'),
  })

  const close = () => {
    setResult(null)
    setPreview(null)
    onClose()
  }

  const s = result?.scan

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          dir="rtl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/40 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
                  <ScanLine className="h-5 w-5 text-primary" />
                  القارئ الذكي للوصفات والتحاليل
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  صوّر الوصفة أو تقرير المختبر — يقرأها المساعد السريري ويلخّصها لك بالعربية.
                </p>
              </div>
              <button onClick={close} aria-label="إغلاق" className="rounded-xl p-1.5 text-muted-foreground hover:bg-black/5">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {(['prescription', 'lab'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition ${
                    mode === m
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-white/40 bg-white/70 text-muted-foreground dark:bg-slate-900/60'
                  }`}
                >
                  {m === 'prescription' ? <Camera className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                  {m === 'prescription' ? 'وصفة طبية' : 'تحليل مخبري'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={scanning.isPending}
              className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-primary transition hover:bg-primary/10 disabled:opacity-60"
            >
              {preview ? (
                <img src={preview} alt="معاينة المستند" className="max-h-40 rounded-xl object-contain" />
              ) : (
                <Camera className="h-8 w-8" />
              )}
              <span className="text-sm font-bold">
                {scanning.isPending ? 'جارٍ التحليل الذكي…' : 'التقاط صورة أو اختيار ملف'}
              </span>
              <span className="text-[11px] text-muted-foreground">JPG · PNG — حتى {MAX_MB}MB</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) scanning.mutate(f)
              }}
            />

            {scanning.isPending && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> يقرأ المساعد السريري المستند…
              </div>
            )}

            {s && (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/40 bg-white/70 p-4 dark:bg-slate-900/60">
                  <p className="text-xs font-black text-primary">{s.documentType}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{s.summaryAr}</p>
                </div>

                {s.medicines.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-black text-foreground">الأدوية المستخرجة</h3>
                    <ul className="space-y-2">
                      {s.medicines.map((m, i) => (
                        <li key={`${m.name}-${i}`} className="rounded-xl border border-white/40 bg-white/60 p-3 text-xs dark:bg-slate-900/50">
                          <p className="font-bold text-foreground">
                            {m.name} {m.strength ? `— ${m.strength}` : ''}
                          </p>
                          {m.dosageAr && <p className="mt-0.5 text-muted-foreground">الجرعة: {m.dosageAr}</p>}
                          {m.durationAr && <p className="text-muted-foreground">المدة: {m.durationAr}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {s.labValues.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-black text-foreground">نتائج التحليل</h3>
                    <div className="overflow-hidden rounded-xl border border-white/40">
                      <table className="w-full text-right text-xs">
                        <tbody>
                          {s.labValues.map((v, i) => (
                            <tr key={`${v.parameter}-${i}`} className="border-b border-white/30 last:border-0 bg-white/60 dark:bg-slate-900/50">
                              <td className="p-2 font-bold text-foreground">{v.parameter}</td>
                              <td className="p-2 text-muted-foreground">{v.value}</td>
                              <td className="p-2 text-muted-foreground">{v.flagAr ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {s.cautionsAr.length > 0 && (
                  <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {s.cautionsAr.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                )}

                {result && result.matches.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-black text-foreground">متوفر في المتجر</h3>
                    <ul className="space-y-2">
                      {result.matches.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/40 bg-white/70 p-3 text-xs dark:bg-slate-900/60">
                          <span className="font-bold text-foreground">{m.name_ar || m.name_en}</span>
                          {m.requires_prescription ? (
                            <span className="rounded-lg bg-amber-100 px-2 py-1 font-bold text-amber-700">بوصفة</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => adding.mutate(m.id)}
                              disabled={adding.isPending}
                              className="press-scale inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" /> أضف
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <a
                  href={buildWhatsAppUrl({
                    kind: 'order',
                    items: s.medicines.map((m) => ({
                      name: `${m.name}${m.strength ? ` ${m.strength}` : ''}`,
                      quantity: 1,
                      dosage: m.dosageAr,
                    })),
                    notes: 'تم استخراج الأصناف من صورة الوصفة عبر القارئ الذكي.',
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press-scale flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-lg"
                >
                  <CheckCircle2 className="h-4 w-4" /> إرسال القائمة للصيدلي عبر واتساب
                </a>
                <p className="text-center text-[11px] text-muted-foreground">
                  القراءة الآلية مساعدة إرشادية ولا تُغني عن مراجعة الصيدلي للوصفة الأصلية.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AiPrescriptionScanner
