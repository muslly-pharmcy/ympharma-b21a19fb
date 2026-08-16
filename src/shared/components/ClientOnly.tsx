import { useEffect, useState, type ReactNode } from 'react'

/** Render children only after hydration — required for recharts / browser-only libs under TanStack SSR. */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <>{fallback}</>
  return <>{children}</>
}
