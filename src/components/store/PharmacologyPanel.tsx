import { BookOpen, AlertTriangle, MessageCircle, Repeat2 } from 'lucide-react'
import { classifyProduct, type PharmacologyResolvable } from '@/lib/medical/pharmacology-tree'
import { PHARMACY } from '@/shared/branding'

interface PharmacologyPanelProps {
  product: PharmacologyResolvable
  /** Product name used in the WhatsApp message. */
  displayName: string
  /** When false, the "out of stock" actions are highlighted. */
  available?: boolean
}

function wa(text: string) {
  return `${PHARMACY.whatsappUrl}?text=${encodeURIComponent(text)}`
}

/**
 * Academic clinical pharmacology reference for a product, plus the
 * out-of-stock path: special order or a pharmacological alternative,
 * both handed off to the pharmacist over WhatsApp.
 */
export function PharmacologyPanel({
  product,
  displayName,
  available = true,
}: PharmacologyPanelProps) {
  const entry = classifyProduct(product)

  return (
    <section dir="rtl" className="space-y-3">
      {entry && (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black text-foreground">المرجع الدوائي الأكاديمي</h2>
          </div>

          <dl className="space-y-2 text-sm">
            <Row label="الجهاز" value={entry.system} />
            <Row label="التصنيف الدوائي" value={entry.drugClass} />
            <Row label="آلية العمل" value={entry.mechanism} />
          </dl>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/40">
              <p className="mb-1 text-xs font-bold text-foreground">الاستخدامات الشائعة</p>
              <ul className="list-inside list-disc space-y-0.5 text-[12px] text-muted-foreground">
                {entry.uses.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="mb-1 flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" /> تحذيرات ومحاذير
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-[12px] text-amber-800/90 dark:text-amber-200/90">
                {entry.cautions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            هذه معلومات تعليمية مرجعية ولا تُغني عن استشارة الطبيب أو الصيدلي المختص.
          </p>
        </div>
      )}

      <div
        className={`rounded-2xl border p-4 ${
          available
            ? 'border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900/40'
            : 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30'
        }`}
      >
        <p className="mb-2 text-sm font-bold text-foreground">
          {available ? 'تحتاج كمية خاصة أو بديل مناسب؟' : 'الصنف غير متوفر حالياً'}
        </p>
        <p className="mb-3 text-[12px] text-muted-foreground">
          تواصل مباشرة مع صيدلي المصلي لطلب توفير الصنف أو اقتراح بديل دوائي من نفس التصنيف.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <a
            href={wa(`مرحباً، أرغب في طلب توفير خاص للصنف: ${displayName}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            <MessageCircle className="h-4 w-4" /> طلب توفير خاص
          </a>
          <a
            href={wa(
              `مرحباً، أحتاج بديلاً دوائياً مناسباً للصنف: ${displayName}${
                classifyProduct(product) ? ` (${classifyProduct(product)!.drugClass})` : ''
              }`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-white px-4 py-2.5 text-sm font-bold text-primary dark:bg-slate-900/60"
          >
            <Repeat2 className="h-4 w-4" /> اقترح بديلاً دوائياً
          </a>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <dt className="shrink-0 text-xs font-bold text-primary">{label}:</dt>
      <dd className="text-[13px] leading-relaxed text-foreground/90">{value}</dd>
    </div>
  )
}

export default PharmacologyPanel
