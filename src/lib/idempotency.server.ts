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

  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('inventory_idempotency')
    .select('actor_id, command, response')
    .eq('key', key)
    .maybeSingle()

  // A global key is not authorization to read another actor's result. Reject
  // collisions before invoking the callback; filtering out the row would turn
  // a forbidden replay into a fresh mutation instead.
  if (lookupError) throw new Error('Unable to verify idempotency receipt')
  if (existing) {
    if (existing.actor_id !== actorId || existing.command !== command) {
      throw new Error('Idempotency key conflicts with another operation')
    }
    return existing.response as T
  }

  // This legacy helper does not make the callback and receipt atomic. Financial
  // commands must use a transactional RPC binding actor, organization, payload
  // and key, as insv2_create_claim_atomic does.

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
