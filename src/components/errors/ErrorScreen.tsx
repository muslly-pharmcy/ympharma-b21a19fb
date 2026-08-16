import { Link } from '@tanstack/react-router'
import { AlertTriangle, Home, LogIn, RefreshCw, ShieldAlert, SignalZero, WifiOff } from 'lucide-react'
import type { ClassifiedError } from '@/lib/errors/classify'

interface Props {
  classified: ClassifiedError
  correlationId: string
  boundary: string
  variant?: 'page' | 'inline'
  onRetry?: () => void
  retrying?: boolean
  retryCount?: number
}

const ICON: Record<ClassifiedError['kind'], React.ComponentType<{ className?: string }>> = {
  network: WifiOff,
  auth: LogIn,
  permission: ShieldAlert,
  notfound: AlertTriangle,
  validation: AlertTriangle,
  conflict: AlertTriangle,
  rate_limit: SignalZero,
  server: AlertTriangle,
  chunk: RefreshCw,
  unknown: AlertTriangle,
}

export function ErrorScreen({
  classified,
  correlationId,
  boundary,
  variant = 'page',
  onRetry,
  retrying,
  retryCount = 0,
}: Props) {
  const Icon = ICON[classified.kind]
  const wrapper =
    variant === 'page'
      ? 'flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-8 text-center'
      : 'flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-6 text-center'

  return (
    <div className={wrapper} role="alert" aria-live="polite" data-error-boundary={boundary}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className={variant === 'page' ? 'text-xl font-bold' : 'text-base font-semibold'}>
        {classified.userMessageAr}
      </h2>
      {classified.kind === 'chunk' && (
        <p className="text-xs text-muted-foreground">
          سيتم تحديث النسخة تلقائيًا عند إعادة التحميل.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {classified.retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'جارٍ المحاولة…' : 'إعادة المحاولة'}
          </button>
        )}
        {classified.kind === 'auth' && (
          <Link
            to="/auth"
            search={{ redirect: typeof window !== 'undefined' ? window.location.pathname : '/' }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            <LogIn className="h-4 w-4" />
            تسجيل الدخول
          </Link>
        )}
        {classified.kind === 'chunk' && (
          <button
            type="button"
            onClick={() => typeof window !== 'undefined' && window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة تحميل التطبيق
          </button>
        )}
        {variant === 'page' && (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium"
          >
            <Home className="h-4 w-4" />
            الصفحة الرئيسية
          </Link>
        )}
      </div>

      {retryCount > 0 && classified.retryable && (
        <p className="text-xs text-muted-foreground">عدد المحاولات: {retryCount}</p>
      )}

      <details className="mt-2 max-w-lg text-start text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none opacity-70">تفاصيل تقنية</summary>
        <div className="mt-2 space-y-1 rounded-lg bg-muted/40 p-3 font-mono leading-relaxed">
          <div>
            <span className="opacity-70">correlation:</span> <code>{correlationId}</code>
          </div>
          <div>
            <span className="opacity-70">boundary:</span> <code>{boundary}</code>
          </div>
          <div>
            <span className="opacity-70">kind:</span> <code>{classified.kind}</code>
            {classified.status ? (
              <>
                {' · '}
                <span className="opacity-70">status:</span> <code>{classified.status}</code>
              </>
            ) : null}
          </div>
          <div className="break-words">
            <span className="opacity-70">message:</span> {classified.message}
          </div>
        </div>
      </details>
    </div>
  )
}
