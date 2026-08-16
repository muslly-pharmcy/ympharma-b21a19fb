// Server-only idempotency wrapper backed by public.inventory_idempotency.
// Load supabaseAdmin lazily to avoid poisoning the client bundle graph.
export async function withIdempotency<T>(
  key: string | undefined,
  actorId: string,
  command: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!key) return fn()

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const { data: existing } = await supabaseAdmin
    .from('inventory_idempotency')
    .select('response')
    .eq('key', key)
    .maybeSingle()

  if (existing?.response) return existing.response as T

  const result = await fn()

  await supabaseAdmin.from('inventory_idempotency').insert({
    key,
    actor_id: actorId,
    command,
    response: (result ?? null) as unknown as never,
  })
  return result
}

export function newCorrelationId(prefix = 'op'): string {
  return `${prefix}-${crypto.randomUUID()}`
}
