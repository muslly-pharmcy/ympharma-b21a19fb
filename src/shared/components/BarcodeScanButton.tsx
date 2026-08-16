import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ScanBarcode } from 'lucide-react'
import { scanBarcode } from '@/lib/native/capacitor'
import { isNativePlatform } from '@/lib/native/platform'

/**
 * Renders only inside the native iOS/Android shell (Capacitor).
 * On the web build it returns null so nothing changes for browser users.
 */
export function BarcodeScanButton({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (!isNativePlatform()) return null

  const onScan = async () => {
    setBusy(true)
    try {
      const code = await scanBarcode()
      if (code) void navigate({ to: '/search', search: { q: code } as never })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onScan()}
      disabled={busy}
      aria-label="مسح الباركود"
      className={`press-scale flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary disabled:opacity-50 ${className}`}
    >
      <ScanBarcode className="h-5 w-5" />
    </button>
  )
}
