import { ShieldCheck, Snowflake, PackageCheck } from 'lucide-react'

interface Props {
  batchNumber?: string | null
  supplier?: string | null
  coldChain?: boolean
  className?: string
}

/** Safety details shown only when supported by order or catalogue data. */
export function AuthenticityBadge({ batchNumber, supplier, coldChain = false, className = '' }: Props) {
  return (
    <div
      dir="rtl"
      className={`rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">فحص الصنف عند التجهيز</p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            يُراجع اسم الصنف وسلامة العبوة والصلاحية قبل تأكيد الطلب.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5 text-[11px] text-emerald-800/90 dark:text-emerald-300/90">
        {supplier && (
          <li className="flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5" /> المورّد: {supplier}
          </li>
        )}
        {batchNumber && (
          <li className="flex items-center gap-1.5">
            <PackageCheck className="h-3.5 w-3.5" /> رقم التشغيلة: <span className="font-mono">{batchNumber}</span>
          </li>
        )}
        {coldChain && (
          <li className="flex items-center gap-1.5 font-bold">
            <Snowflake className="h-3.5 w-3.5" /> هذا الصنف يتطلب التبريد (2–8°م)
          </li>
        )}
      </ul>
    </div>
  )
}

export default AuthenticityBadge
