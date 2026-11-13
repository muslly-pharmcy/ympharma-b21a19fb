import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { erpV2Handle } from '@/lib/erp/v2-handler.server'

// Monetary values stay strings; never round invoice/retail money in JS floats.
const decimal4 = z.string().regex(/^[0-9]{1,11}(?:\.[0-9]{1,4})?$/)
const row = z.object({
  external_item: z.string().trim().min(1).max(120),
  external_branch: z.string().trim().min(1).max(120),
  source_version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  qty_available: decimal4,
  unit_code: z.string().trim().min(1).max(20),
  selling_price: decimal4.nullable().optional(),
  official_reference_price: decimal4.nullable().optional(),
  currency: z.enum(['YER', 'SAR', 'USD']),
}).strict()
const envelope = z.object({
  sourceSystem: z.string().min(1).max(120),
  rows: z.array(row).min(1).max(500),
}).strict()

export const Route = createFileRoute('/api/public/erp/v2/stock')({
  server: {
    handlers: {
      POST: ({ request }) =>
        erpV2Handle(request, '/api/public/erp/v2/stock', async (payload, db, organizationId) => {
          const parsed = envelope.safeParse(payload)
          if (!parsed.success) return { status: 400, body: { error: 'invalid_stock_envelope' } }
          const { data, error } = await db.rpc('erp2_apply_stock_snapshots', {
            p_org_id: organizationId,
            p_rows: parsed.data.rows,
          })
          if (error?.code === '23503') return { status: 409, body: { error: 'product_or_branch_unmapped' } }
          if (error?.code === '22023') return { status: 400, body: { error: 'invalid_stock_row' } }
          if (error) return { status: 503, body: { error: 'erp_v2_stock_not_applied' } }
          return { status: 200, body: { received: parsed.data.rows.length, ...(data as object) } }
        }),
    },
  },
})
