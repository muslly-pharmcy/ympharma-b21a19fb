import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { classifyError } from '@/lib/errors/classify'
import { newCorrelationId } from '@/lib/errors/correlation'
import { registerErrorHook, reportError } from '@/lib/errors/logger'
import { sendReportToSupabase } from '@/lib/errors/supabase-sink'
import { installErrorHealer } from '@/lib/errors/healer'

/**
 * Global runtime error observability + auto-healing.
 * - Captures window.onerror and unhandledrejection (React boundaries only cover render).
 * - Ships each report to public.error_logs (device info, stack, correlation id).
 * - Installs the auto-healer: reinvalidates queries when network recovers, prompts
 *   reload on stale bundles, notifies on auth loss.
 */
export function GlobalErrorListeners() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // Structured sink → public.error_logs (RLS-guarded insert with size caps).
  useEffect(() => {
    return registerErrorHook((report) => {
      void sendReportToSupabase(report)
    })
  }, [])

  // Auto-healer with app-specific recovery actions.
  useEffect(() => {
    installErrorHealer({
      queryClient,
      onChunkStale: () => {
        toast.message('يتوفر تحديث للتطبيق', {
          description: 'اضغط لإعادة التحميل والحصول على أحدث نسخة.',
          action: {
            label: 'تحديث',
            onClick: () => {
              if (typeof window !== 'undefined') window.location.reload()
            },
          },
          duration: 10_000,
        })
      },
      onAuthLost: () => {
        toast.error('انتهت الجلسة — يرجى تسجيل الدخول من جديد')
        void navigate({ to: '/auth' })
      },
    })
  }, [queryClient, navigate])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      try {
        const err = event.error instanceof Error ? event.error : new Error(event.message)
        reportError({
          correlationId: newCorrelationId('window'),
          classified: classifyError(err),
          boundary: 'window:error',
          extra: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        })
      } catch {
        /* swallow — logging must never crash */
      }
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = event.reason
        const err = reason instanceof Error ? reason : new Error(String(reason))
        reportError({
          correlationId: newCorrelationId('promise'),
          classified: classifyError(err),
          boundary: 'window:unhandledrejection',
        })
      } catch {
        /* swallow */
      }
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}
