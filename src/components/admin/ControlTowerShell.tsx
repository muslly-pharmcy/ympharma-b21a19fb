import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Loader2, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { isCurrentUserAdmin } from '@/lib/admin-orders.functions'

interface Props {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Shared Control Tower chrome: admin gate + glass medical control-center styling.
 * Server functions and RLS remain the real authorization layer.
 */
export function ControlTowerShell({ title, subtitle, children }: Props) {
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ['is-admin'],
    queryFn: () => isCurrentUserAdmin(),
    staleTime: 5 * 60_000,
  })

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6">
          <Link
            to="/control-tower"
            className="text-xs font-medium text-emerald-400/80 transition hover:text-emerald-300"
          >
            صيدلية المصلي — الإدارة المركزية
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-sm text-slate-400">{subtitle}</p>}
        </header>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center backdrop-blur-xl">
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="font-semibold text-red-200">صلاحيات الإدارة المركزية مطلوبة</p>
            <p className="mt-1 text-sm text-red-200/70">
              هذه المنطقة مخصّصة لمديري النظام فقط.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  )
}

export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  )
}
