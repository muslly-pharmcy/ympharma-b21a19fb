import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, Info, ShieldAlert, Sparkles } from 'lucide-react'
import { runClinicalCheckForPrescription } from '@/lib/clinical.functions'

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 text-red-800 border-red-200',
  high: 'bg-orange-50 text-orange-800 border-orange-200',
  moderate: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
}

export function ClinicalWarningsPanel({ prescriptionId }: { prescriptionId: string }) {
  const runM = useMutation({
    mutationFn: () => runClinicalCheckForPrescription({ data: { prescriptionId } }),
  })

  return (
    <section className="glass-panel rounded-2xl p-6" dir="rtl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="h-5 w-5 text-indigo-600" />
          الفحص السريري الاستشاري
        </h2>
        <button
          onClick={() => runM.mutate()}
          disabled={runM.isPending}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {runM.isPending ? 'جارٍ الفحص...' : 'تشغيل الفحص'}
        </button>
      </div>

      {!runM.data && !runM.isPending && (
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          هذا الفحص استشاري فقط ولا يستبدل الحكم السريري. النتائج تعتمد على مزوّد المعرفة الدوائية المُفعَّل.
        </p>
      )}

      {runM.data && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            المزود: <span className="font-mono">{runM.data.providerName}</span>
            {' • '}
            {new Date(runM.data.ranAt).toLocaleString('ar-SA')}
          </div>

          {runM.data.warnings.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              لا توجد تنبيهات من المزوّد الحالي.
            </p>
          ) : (
            <ul className="space-y-2">
              {runM.data.warnings.map((w, i) => (
                <li key={i} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${SEVERITY_STYLE[w.severity] ?? ''}`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center gap-2 text-xs uppercase tracking-wide">
                      <span className="font-semibold">{w.category}</span>
                      <span>•</span>
                      <span>{w.severity}</span>
                    </div>
                    <p>{w.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {runM.isError && (
        <p className="mt-2 text-sm text-red-600">
          فشل الفحص: {(runM.error as Error).message}
        </p>
      )}
    </section>
  )
}
