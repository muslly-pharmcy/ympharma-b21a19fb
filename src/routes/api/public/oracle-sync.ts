import { createFileRoute } from '@tanstack/react-router'
import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'

// Signed receiver for the pharmacy-PC Oracle connector (scripts/oracle-supabase-sync.ps1).
// Signature: HMAC-SHA256(ORACLE_SYNC_HMAC_SECRET, `${timestamp}.${body}`).
const ORG_ID = '11111111-1111-1111-1111-000000000001'
const WAREHOUSE_ID = '22222222-2222-2222-2222-000000000001'
const MAX_BODY = 1_000_000

const rowSchema = z.object({
  entityType: z.enum(['product', 'barcode', 'warehouse', 'stock_batch']),
  sourceKey: z.string().min(1).max(240),
  idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/i),
  sourceUpdatedAt: z.string().nullish(),
  payload: z.record(z.string(), z.unknown()),
})
const envelopeSchema = z.object({
  batchId: z.string().min(1).max(160),
  sourceSystem: z.string().min(1).max(120),
  mode: z.enum(['dry-run', 'apply']),
  rows: z.array(rowSchema).min(1).max(500),
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const txt = (p: Record<string, unknown>, k: string) => {
  const v = p[k]
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}
const num = (p: Record<string, unknown>, k: string) => {
  const n = Number(p[k])
  return Number.isFinite(n) ? n : null
}
const date = (p: Record<string, unknown>, k: string) => {
  const s = txt(p, k)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export const Route = createFileRoute('/api/public/oracle-sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['ORACLE_SYNC_HMAC_SECRET']
        if (!secret) return json(503, { error: 'sync_secret_not_configured' })

        const ts = request.headers.get('x-sync-timestamp') ?? ''
        const sig = (request.headers.get('x-sync-signature') ?? '').toLowerCase()
        const t = Number(ts)
        if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) {
          return json(401, { error: 'stale_or_invalid_timestamp' })
        }
        const body = await request.text()
        if (body.length > MAX_BODY) return json(413, { error: 'payload_too_large' })
        const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
        if (!/^[a-f0-9]{64}$/.test(sig) || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          return json(401, { error: 'invalid_signature' })
        }

        let env: z.infer<typeof envelopeSchema>
        try {
          env = envelopeSchema.parse(JSON.parse(body))
        } catch {
          return json(400, { error: 'invalid_envelope' })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const db = supabaseAdmin as unknown as {
          from: (t: string) => any
          rpc: (n: string, a: unknown) => Promise<{ data: unknown; error: { message: string } | null }>
        }

        const { error: runErr } = await db.from('oracle_sync_runs').upsert(
          { batch_id: env.batchId, source_system: env.sourceSystem, mode: env.mode, status: 'receiving', received_rows: env.rows.length },
          { onConflict: 'batch_id' },
        )
        if (runErr) return json(500, { error: 'run_log_failed' })

        await db.from('oracle_sync_staging').upsert(
          env.rows.map((r) => ({
            batch_id: env.batchId,
            source_system: env.sourceSystem,
            entity_type: r.entityType,
            source_key: r.sourceKey,
            idempotency_key: r.idempotencyKey.toLowerCase(),
            payload: r.payload,
            source_updated_at: r.sourceUpdatedAt ?? null,
          })),
          { onConflict: 'idempotency_key', ignoreDuplicates: true },
        )

        const products = env.rows
          .filter((r) => r.entityType === 'product')
          .map((r) => ({
            store_code: txt(r.payload, 'store_code'),
            name_ar: txt(r.payload, 'name_ar'),
            name_en: txt(r.payload, 'name_en'),
            brand: txt(r.payload, 'brand'),
            generic_name: txt(r.payload, 'generic_name'),
            strength: txt(r.payload, 'strength'),
            dosage_form: txt(r.payload, 'dosage_form'),
            manufacturer: txt(r.payload, 'manufacturer'),
            barcode: txt(r.payload, 'barcode'),
          }))
        const validProducts = products.filter((p) => p.store_code && p.name_ar)
        const stock = env.rows
          .filter((r) => r.entityType === 'stock_batch')
          .map((r) => ({
            source_key: r.sourceKey,
            store_code: txt(r.payload, 'store_code'),
            batch_no: txt(r.payload, 'batch_no'),
            expiry_date: date(r.payload, 'expiry_date'),
            qty_on_hand: num(r.payload, 'qty_on_hand'),
            selling_price: num(r.payload, 'selling_price'),
          }))
          .filter((s) => s.store_code)
        const rejected = products.length - validProducts.length

        let applied = 0
        if (env.mode === 'apply') {
          if (validProducts.length) {
            const { data, error } = await db.rpc('apply_oracle_sync_products', { p_rows: validProducts, p_org: ORG_ID })
            if (error) {
              await db.from('oracle_sync_runs').update({ status: 'failed', error: 'product_apply_failed' }).eq('batch_id', env.batchId)
              return json(500, { error: 'product_apply_failed' })
            }
            applied += Number(data ?? 0)
          }
          if (stock.length) {
            const { data, error } = await db.rpc('apply_oracle_sync_stock', { p_rows: stock, p_org: ORG_ID, p_warehouse: WAREHOUSE_ID })
            if (error) {
              await db.from('oracle_sync_runs').update({ status: 'failed', error: 'stock_apply_failed' }).eq('batch_id', env.batchId)
              return json(500, { error: 'stock_apply_failed' })
            }
            applied += Number(data ?? 0)
          }
        }

        await db.from('oracle_sync_staging')
          .update({ status: env.mode === 'apply' ? 'applied' : 'validated', applied_at: env.mode === 'apply' ? new Date().toISOString() : null })
          .eq('batch_id', env.batchId)
        await db.from('oracle_sync_runs').update({
          status: env.mode === 'apply' ? 'completed' : 'validated',
          applied_rows: applied,
          error_rows: rejected,
          skipped_rows: Math.max(env.rows.length - applied - rejected, 0),
          completed_at: new Date().toISOString(),
        }).eq('batch_id', env.batchId)

        return json(200, { batchId: env.batchId, mode: env.mode, received: env.rows.length, applied, rejected })
      },
    },
  },
})
