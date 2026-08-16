// Tool Registry — metadata wrapper over the existing ai/tools.server registry.
// Adds: capability + cost + latency + timeout + retry-policy + owner + version.
// The Kernel consults metadata BEFORE calling ToolExecutor to enforce policy.
import type { ToolDefinition } from '../tools.server'
import { z } from 'zod'

export interface ToolMetadata {
  key: string
  capability: 'read' | 'write' | 'execute'
  permissions: string[]              // permission strings gated by session
  costCents: number                  // rough per-call cost estimate
  latencyMsP95: number
  timeoutMs: number
  retryPolicy: { attempts: number; backoffMs: number }
  owner: string                      // team/agent owning this tool
  version: number
}

const META: Record<string, ToolMetadata> = {
  search_products:       { key: 'search_products',       capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 250, timeoutMs: 5000, retryPolicy: { attempts: 2, backoffMs: 300 }, owner: 'catalog',   version: 1 },
  store_query:           { key: 'store_query',           capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 300, timeoutMs: 8000, retryPolicy: { attempts: 2, backoffMs: 300 }, owner: 'catalog',   version: 1 },
  get_product_stock:     { key: 'get_product_stock',     capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 220, timeoutMs: 5000, retryPolicy: { attempts: 2, backoffMs: 300 }, owner: 'inventory', version: 1 },
  list_low_stock:        { key: 'list_low_stock',        capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 400, timeoutMs: 8000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'inventory', version: 1 },
  list_expiring_soon:    { key: 'list_expiring_soon',    capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 300, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'inventory', version: 1 },
  ops_snapshot:          { key: 'ops_snapshot',          capability: 'read',    permissions: [],                     costCents: 0, latencyMsP95: 600, timeoutMs: 8000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'ops',       version: 1 },
  get_loyalty_balance:   { key: 'get_loyalty_balance',   capability: 'read',    permissions: ['ai.loyalty.read'],    costCents: 0, latencyMsP95: 200, timeoutMs: 5000, retryPolicy: { attempts: 2, backoffMs: 300 }, owner: 'crm',       version: 1 },
  customer_loyalty_history: { key: 'customer_loyalty_history', capability: 'read', permissions: ['ai.loyalty.read'], costCents: 0, latencyMsP95: 250, timeoutMs: 5000, retryPolicy: { attempts: 2, backoffMs: 300 }, owner: 'crm',   version: 1 },
  suggest_rewards:       { key: 'suggest_rewards',       capability: 'read',    permissions: ['ai.loyalty.read'],    costCents: 0, latencyMsP95: 300, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  campaign_statistics:   { key: 'campaign_statistics',   capability: 'read',    permissions: ['ai.campaign.read'],   costCents: 0, latencyMsP95: 350, timeoutMs: 6000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  segment_preview:       { key: 'segment_preview',       capability: 'read',    permissions: ['ai.campaign.read'],   costCents: 0, latencyMsP95: 200, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  recommend_campaign:    { key: 'recommend_campaign',    capability: 'read',    permissions: ['ai.campaign.read'],   costCents: 0, latencyMsP95: 250, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  validate_coupon:       { key: 'validate_coupon',       capability: 'read',    permissions: ['campaign.read'],      costCents: 0, latencyMsP95: 200, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  promotion_statistics:  { key: 'promotion_statistics',  capability: 'read',    permissions: ['campaign.read'],      costCents: 0, latencyMsP95: 400, timeoutMs: 6000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
  suggest_promotions:    { key: 'suggest_promotions',    capability: 'read',    permissions: ['campaign.read'],      costCents: 0, latencyMsP95: 250, timeoutMs: 5000, retryPolicy: { attempts: 1, backoffMs: 0   }, owner: 'crm',       version: 1 },
}

// Tool arguments cross the model-to-database boundary.  Keep their contracts
// here, next to the policy metadata, so every caller receives the same
// validation before a tool can query an organization-scoped data source.
const id = z.string().uuid()
const searchText = z.string().trim().min(1).max(120)
const boundedLimit = (fallback: number, maximum: number) =>
  z.coerce.number().int().min(1).max(maximum).optional().default(fallback)

const INPUT_SCHEMAS = {
  search_products: z
    .object({
      query: searchText.optional(),
      code: z.string().trim().min(1).max(80).optional(),
      supplier: z.string().trim().min(1).max(120).optional(),
      limit: boundedLimit(15, 50),
    })
    .strict()
    .refine((value) => Boolean(value.query || value.code || value.supplier), {
      message: 'query, code, or supplier is required',
    }),
  store_query: z.object({ productId: id }).strict(),
  get_product_stock: z.object({ product_id: id }).strict(),
  list_low_stock: z.object({ threshold: z.coerce.number().finite().min(0).max(1_000_000).optional().default(10) }).strict(),
  list_expiring_soon: z.object({ days: z.coerce.number().int().min(1).max(365).optional().default(60) }).strict(),
  ops_snapshot: z.object({}).strict(),
  get_loyalty_balance: z.object({ customer_id: id }).strict(),
  customer_loyalty_history: z.object({ customer_id: id, limit: boundedLimit(20, 100) }).strict(),
  suggest_rewards: z.object({ customer_id: id }).strict(),
  campaign_statistics: z.object({ limit: boundedLimit(20, 100) }).strict(),
  segment_preview: z.object({ segment_id: id }).strict(),
  recommend_campaign: z.object({ segment_id: id }).strict(),
  validate_coupon: z.object({ code: z.string().trim().min(1).max(64) }).strict(),
  promotion_statistics: z.object({}).strict(),
  suggest_promotions: z.object({ category: z.string().trim().min(1).max(80).optional(), tier: z.string().trim().min(1).max(80).optional() }).strict(),
} as const

export type ToolInputKey = keyof typeof INPUT_SCHEMAS

export class ToolInputValidationError extends Error {
  constructor(readonly toolKey: string, readonly issues: z.core.$ZodIssue[]) {
    super(`Invalid input for tool '${toolKey}'`)
    this.name = 'ToolInputValidationError'
  }
}

/** A tool cannot cross the kernel boundary without an explicit input contract. */
export class ToolRegistrationError extends Error {
  constructor(readonly toolKey: string, readonly reason: 'missing_input_schema' | 'missing_metadata') {
    super(`Tool '${toolKey}' is not registered for execution: ${reason}`)
    this.name = 'ToolRegistrationError'
  }
}

/** Validate untrusted model/caller input before an executor can run. */
export function validateToolInput(key: string, input: unknown): Record<string, unknown> {
  const schema = INPUT_SCHEMAS[key as ToolInputKey]
  if (!schema) throw new ToolRegistrationError(key, 'missing_input_schema')
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new ToolInputValidationError(key, parsed.error.issues)
  return parsed.data as Record<string, unknown>
}

export function getToolMeta(key: string): ToolMetadata | undefined {
  return META[key]
}

export function listToolMeta(): ToolMetadata[] {
  return Object.values(META)
}

export async function runToolWithPolicy(
  tool: ToolDefinition,
  ctx: Parameters<ToolDefinition['execute']>[0],
  input: Parameters<ToolDefinition['execute']>[1],
) {
  const meta = getToolMeta(tool.key)
  if (!meta) throw new ToolRegistrationError(tool.key, 'missing_metadata')
  const validatedInput = validateToolInput(tool.key, input)
  const attempts = meta.retryPolicy.attempts
  const backoff = meta.retryPolicy.backoffMs
  const timeout = meta.timeoutMs
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const race = new Promise<never>((_r, reject) =>
        (timeoutHandle = setTimeout(() => reject(new Error(`tool:${tool.key} timeout ${timeout}ms`)), timeout)),
      )
      return await Promise.race([tool.execute(ctx, validatedInput), race])
    } catch (err) {
      lastErr = err
      if (i < attempts - 1 && backoff > 0) await new Promise((r) => setTimeout(r, backoff))
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}
