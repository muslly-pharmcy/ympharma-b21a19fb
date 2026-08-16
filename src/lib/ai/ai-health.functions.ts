import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { AiHealthSummary } from './observability.server'

/**
 * Read-only AI health snapshot for the Control Tower.
 * Admin/owner only — aggregates the unified AI telemetry rows, no PII, no keys.
 */
export const getAiHealth = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ hours: z.number().int().min(1).max(168).default(24) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<AiHealthSummary> => {
    const { data: isAdmin } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    })
    const { data: isOwner } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'owner',
    })
    if (!isAdmin && !isOwner) throw new Error('صلاحيات المشرف مطلوبة')

    const { aiHealthSummary } = await import('./observability.server')
    return aiHealthSummary(data.hours)
  })
