import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { erpHandle } from '@/lib/erp/handler.server'

const row = z.object({
  erp_item_id: z.string().min(1).max(120),
  erp_branch_id: z.string().min(1).max(120),
  source_version: z.number().int().nonnegative(),
  qty_available: z.number().nonnegative(),
  unit_code: z.string().min(1).max(20),
  selling_price: z.number().nonnegative().nullish(),
  official_reference_price: z.number().nonnegative().nullish(),
  purchase_cost: z.number().nonnegative().nullish(),
  currency: z.enum(['YER', 'SAR', 'USD']).default('YER'),
})
const envelope = z.object({ sourceSystem: z.string().min(1).max(120), rows: z.array(row).min(1).max(500) })

export const Route = createFileRoute('/api/public/erp/v1/stock')({
  server: {
    handlers: {
      POST: ({ request }) =>
        erpHandle(request, '/api/public/erp/v1/stock', async (body, db) => {
          const p = envelope.safeParse(body)
          if (!p.success) return { status: 400, body: { error: 'invalid_envelope' } }
          const { data, error } = await db.rpc('erp_apply_stock_snapshots', { p_rows: p.data.rows })
          if (error) return { status: 500, body: { error: 'apply_failed' } }
          return { status: 200, body: { received: p.data.rows.length, ...data } }
        }),
    },
  },
})
