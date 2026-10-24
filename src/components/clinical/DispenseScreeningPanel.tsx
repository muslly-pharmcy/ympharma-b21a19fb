import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sparkles, Stethoscope } from 'lucide-react'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import {
  useDispenseScreening,
  useOverrideScreening,
  useScreenDispense,
  useSummarizeScreening,
} from '@/hooks/mutations/clinical-screening'
import {
  CONFIDENCE_LABEL_AR,
  SEVERITY_LABEL_AR,
  type ScreeningSnapshot,
} from '@/domain/clinical-screening/schemas'

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 text-red-800 border-red-200',
  high: 'bg-orange-50 text-orange-800 border-orange-200',
  moderate: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-slate-50 text-slate-700 border-slate-200',
}

function ConfidenceBadge({ screening }: { screening: ScreeningSnapshot }) {
  const tone =
    screening.confidence === 'verified'
      ? 'bg-emerald-100 text-emerald-700'
      : screening.confidence === 'partial'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${tone}`}>
      {CONFIDENCE_LABEL_AR[screening.confidence]}
    </span>
  )
}

export function DispenseScreeningPanel({
  dispenseId,
  status,
}: {
  dispenseId: string
  status: string
}) {
  const { isFlagEnabled } = useFeatureFlags()
  const enabled = isFlagEnabled('enable_clinical_inspector')

  const screeningQuery = useDispenseScreening(dispenseId)
  const screenMutation = useScreenDispense(dispenseId)
  const overrideMutation = useOverrideScreening(dispenseId)
  const summarizeMutation = useSummarizeScreening(dispenseId)

  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  if (!enabled) return null

  const screening = screeningQuery.data?.screening ?? null
  const canScreen = status !== 'completed' && status !== 'returned' && status !== 'cancelled'
  const criticalUnresolved =
    screening?.highestSeverity === 'critical' && screening.override === null
  const busy =
    screenMutation.isPending || overrideMutation.isPending || summarizeMutation.isPending
  const error = screeningQuery.error ?? screenMutation.error ?? overrideMutation.error ?? summarizeMutation.error

  return (
    <section className="bg-white rounded-xl shadow p-6 space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Stethoscope className="w-5 h-5 text-indigo-600" />
          فحص السلامة السريرية
        </h2>
        <div className="flex items-center gap-2">
          {screening && <ConfidenceBadge screening={screening} />}
          {canScreen && (
            <button
              onClick={() => screenMutation.mutate()}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4" />
              {screenMutation.isPending ? 'جارٍ الفحص...' : screening ? 'إعادة الفحص' : 'تشغيل الفحص'}
            </button>
          )}
        </div>
      </div>

      {!screening && !screeningQuery.isLoading && (
        <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          لا يوجد فحص مسجّل لهذا الصرف بعد. الفحص استشاري، والتنبيه الحرج يتطلب موافقة صيدلي مسجلة قبل الصرف.
        </p>
      )}

      {screening && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>
              المزوّد: <span className="font-mono">{screening.providerName}</span>
            </span>
            <span>{new Date(screening.ranAt).toLocaleString('ar-SA')}</span>
            <span>
              النتائج: <b>{screening.warningCount}</b>
            </span>
            <span className="font-mono text-[10px] text-gray-400">#{screening.inputHash}</span>
          </div>

          {screening.highestSeverity === 'critical' && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                screening.override ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                {screening.override
                  ? 'تنبيه حرج — تم تجاوزه بقرار صيدلي مسجّل'
                  : 'تنبيه حرج — الصرف محظور حتى تسجيل سبب التجاوز'}
              </div>
              {screening.override && (
                <p className="mt-1 text-xs">
                  السبب: {screening.override.reason} —{' '}
                  {screening.override.at
                    ? new Date(screening.override.at).toLocaleString('ar-SA')
                    : ''}
                </p>
              )}
            </div>
          )}

          {screening.warnings.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              لا توجد تنبيهات من المزوّد الحالي. تبقى المراجعة الصيدلية مطلوبة.
            </p>
          ) : (
            <ul className="space-y-2">
              {screening.warnings.map((warning, index) => (
                <li
                  key={`${warning.code}-${index}`}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    SEVERITY_STYLE[warning.severity] ?? ''
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="mb-0.5 flex items-center gap-2 text-xs uppercase tracking-wide">
                      <span className="font-semibold">{warning.category}</span>
                      <span>•</span>
                      <span>{SEVERITY_LABEL_AR[warning.severity]}</span>
                      <span>•</span>
                      <span className="font-mono">{warning.code}</span>
                    </div>
                    <p>{warning.message}</p>
                    {warning.evidenceUrl && (
                      <a
                        href={warning.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                      >
                        الدليل
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">الملخص</span>
              <span className="text-[10px] uppercase text-slate-400">
                {screening.summarySource === 'ai' ? 'AI + تنبيهات' : 'قاعدة قواعد حتمية'}
              </span>
            </div>
            <p>{screening.summaryAr}</p>
            {screening.warnings.length > 0 && (
              <button
                onClick={() => summarizeMutation.mutate(screening.id)}
                disabled={busy}
                className="mt-2 flex items-center gap-1 text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {summarizeMutation.isPending ? 'جارٍ التلخيص...' : 'توليد ملخص بالذكاء الاصطناعي'}
              </button>
            )}
          </div>

          {criticalUnresolved && (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">تجاوز الحظر (يتطلب صلاحية تحقق الصرف)</p>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="سبب التجاوز (10 أحرف على الأقل) — يُسجَّل في سجل التدقيق"
                className="w-full rounded border p-2 text-sm"
                rows={2}
              />
              <label className="flex items-center gap-2 text-xs text-red-800">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                أُقرّ بأنني راجعت التنبيهات وأتحمل القرار السريري.
              </label>
              <button
                onClick={() =>
                  overrideMutation.mutate({ screeningId: screening.id, reason: reason.trim() })
                }
                disabled={busy || reason.trim().length < 10 || !acknowledged}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {overrideMutation.isPending ? 'جارٍ التسجيل...' : 'تسجيل التجاوز والمتابعة'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error.message}</p>
      )}
    </section>
  )
}
