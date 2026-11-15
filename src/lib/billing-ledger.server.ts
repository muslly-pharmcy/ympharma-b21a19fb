import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { z } from 'zod'
import { billingEntry, billingWindow, type BillingPeriod } from '@/lib/billing-ledger'

export async function readBillingLedger(
  context: { supabase: SupabaseClient<Database>; userId: string },
  period: BillingPeriod,
  now = new Date(),
) {
  // Billing RLS is administrator-only; enforce it before an empty result can masquerade as no activity.
  const { data: isAdmin, error: roleError } = await context.supabase.rpc('has_role', {
    _user_id: context.userId, _role: 'admin',
  })
  if (roleError || !isAdmin) throw new Error('غير مصرح بعرض سجل الفوترة')
  const window = billingWindow(period, now)
  const { data: rows, error } = await context.supabase
    .from('billing_ledger')
    .select('id, entry_type, amount_yer, notes, created_at')
    .gte('created_at', window.from)
    .lt('created_at', window.to)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(101)
  if (error) throw new Error('تعذر تحميل سجل الفوترة؛ أعد المحاولة')
  const entries = z.array(billingEntry).parse(rows ?? [])
  return { items: entries.slice(0, 100), truncated: entries.length > 100 }
}
