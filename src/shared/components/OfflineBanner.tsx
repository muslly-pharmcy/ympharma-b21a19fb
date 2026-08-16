import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { subscribeToQueue } from '@/lib/offline/cart-queue'

/**
 * Non-intrusive connectivity banner. Shows pending cart operations while
 * offline and a short auto-resync confirmation when the network returns.
 */
export function OfflineBanner() {
  const { online, mounted } = useOnlineStatus()
  const [pending, setPending] = useState(0)
  const [justReconnected, setJustReconnected] = useState(false)

  useEffect(() => subscribeToQueue((entries) => setPending(entries.length)), [])

  useEffect(() => {
    if (!mounted || !online) return
    if (pending === 0) return
    setJustReconnected(true)
    const t = setTimeout(() => setJustReconnected(false), 4000)
    return () => clearTimeout(t)
  }, [online, mounted, pending])

  if (!mounted) return null

  if (online) {
    if (!justReconnected) return null
    return (
      <div
        role="status"
        dir="rtl"
        className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-center text-xs font-medium text-white shadow-md sm:text-sm"
      >
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <span>عاد الاتصال — تتم مزامنة العمليات المعلّقة تلقائياً.</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-medium text-white shadow-md sm:text-sm"
      dir="rtl"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        لا يوجد اتصال بالإنترنت — يمكنك التصفح، وسيتم إتمام العمليات تلقائياً عند عودة الاتصال.
        {pending > 0 ? ` (${pending} عملية معلّقة)` : ''}
      </span>
    </div>
  )
}
