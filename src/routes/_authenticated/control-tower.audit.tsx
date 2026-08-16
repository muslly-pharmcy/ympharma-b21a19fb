import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2, ScrollText } from 'lucide-react'
import { ControlTowerShell, GlassCard } from '@/components/admin/ControlTowerShell'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/control-tower/audit')({
  head: () => ({
    meta: [
      { title: 'سجل التدقيق الإداري — صيدلية المصلي' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AuditLogPage,
})

interface AuditRow {
  id: string
  action: string
  target_key: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

function preview(value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

function AuditLogPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['control-tower-audit'],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from('control_tower_audit_log')
        .select('id, action, target_key, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw new Error(error.message)
      return (data ?? []) as AuditRow[]
    },
  })


  return (
    <ControlTowerShell
      title="سجل التدقيق الإداري"
      subtitle="سجل غير قابل للتعديل لآخر 100 تغيير على إعدادات النظام."
    >
      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : isError ? (
        <GlassCard>
          <p className="text-sm text-red-300">تعذر تحميل سجل التدقيق.</p>
        </GlassCard>
      ) : !data || data.length === 0 ? (
        <GlassCard>
          <div className="py-8 text-center text-slate-400">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            لا توجد تغييرات مسجّلة بعد.
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="border-b border-white/10 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">الإعداد</th>
                <th className="px-4 py-3 font-medium">القيمة السابقة</th>
                <th className="px-4 py-3 font-medium">القيمة الجديدة</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-white">
                    {row.target_key ?? row.action}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{preview(row.old_value)}</td>
                  <td className="px-4 py-3 text-emerald-300">{preview(row.new_value)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.created_at).toLocaleString('ar-YE')}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </ControlTowerShell>
  )
}
