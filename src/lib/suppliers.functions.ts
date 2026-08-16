import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import type { Supplier } from '@/domain/suppliers/schemas'

// Wave R1.2 — Public Function Review.
// Verdict: Authenticated by design. Suppliers are internal, org-scoped
// records; the only caller is /_authenticated/suppliers.tsx.
const sel = (s: string): string => s

export const listSuppliers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Supplier[]> => {
    const { data, error } = await context.supabase
      .from('sup_suppliers')
      .select(sel('*'))
      .eq('status', 'active')
      .order('name')
    if (error) {
      console.error('[listSuppliers]', error)
      return []
    }
    return (data ?? []) as unknown as Supplier[]
  })
