import { createServerFn } from '@tanstack/react-start'
import {
  createCampaignInput, updateCampaignInput, transitionCampaignInput, scheduleCampaignInput,
  upsertSegmentInput, recalcSegmentInput, startCampaignInput,
  type CreateCampaignInput, type UpdateCampaignInput, type TransitionCampaignInput,
  type ScheduleCampaignInput, type UpsertSegmentInput, type RecalcSegmentInput, type StartCampaignInput,
} from '@/domain/crm/campaigns-commands'
import { isLegalTransition } from '@/domain/crm/segment-dsl'

type RpcFn = (name: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>

async function emit(event: string, payload: Record<string, unknown>, correlation: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  await (supabaseAdmin.rpc as unknown as RpcFn)('emit_domain_event', {
    p_event_type: event,
    p_source: 'campaigns-mutations',
    p_payload: payload as unknown as never,
    p_priority: 'normal',
    p_correlation_id: correlation,
  })
}

// ============ Segments ============
export const upsertSegment = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpsertSegmentInput => upsertSegmentInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'segment.write')
    const correlation = newCorrelationId('segment')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const patch = {
      organization_id: actor.organizationId,
      name: data.name,
      description: data.description ?? null,
      rules: data.rules as unknown as never,
      combinator: data.combinator,
    }
    let id = data.id
    if (id) {
      // verify ownership
      const { data: existing } = await sb.from('crm_segments').select('id, organization_id').eq('id', id).maybeSingle()
      if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Segment not found')
      const { error } = await sb.from('crm_segments').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
      await emit('SegmentUpdated', { segment_id: id }, correlation)
      await audit(actor, { action: 'segment.update', resourceType: 'segment', resourceId: id })
    } else {
      const { data: row, error } = await sb.from('crm_segments').insert({ ...patch, created_by: actor.userId }).select('id').single()
      if (error) throw new Error(error.message)
      id = row.id as string
      await emit('SegmentCreated', { segment_id: id }, correlation)
      await audit(actor, { action: 'segment.create', resourceType: 'segment', resourceId: id })
    }
    return { id: id as string, correlationId: correlation }
  })

export const recalcSegment = createServerFn({ method: 'POST' })
  .validator((raw: unknown): RecalcSegmentInput => recalcSegmentInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const { evaluateSegment } = await import('./segments/engine.server')
    const actor = await getActor()
    requirePermission(actor, 'segment.write')
    const correlation = newCorrelationId('segment-recalc')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: seg } = await sb.from('crm_segments').select('id, organization_id, rules, combinator').eq('id', data.id).maybeSingle()
    if (!seg || seg.organization_id !== actor.organizationId) throw new Error('Segment not found')

    const ids = await evaluateSegment({
      organizationId: actor.organizationId,
      rules: (seg.rules ?? []) as never,
      combinator: (seg.combinator ?? 'and') as 'and' | 'or',
    })
    const { data: cnt, error } = await (supabaseAdmin.rpc as unknown as RpcFn)('crm_segment_recalc', {
      p_segment_id: data.id,
      p_customer_ids: ids as unknown as never,
    })
    if (error) throw new Error(error.message)
    await emit('SegmentRecalculated', { segment_id: data.id, member_count: cnt }, correlation)
    await audit(actor, { action: 'segment.recalc', resourceType: 'segment', resourceId: data.id, payload: { member_count: cnt } })
    return { memberCount: Number(cnt ?? 0), correlationId: correlation }
  })

// ============ Campaigns ============
export const createCampaign = createServerFn({ method: 'POST' })
  .validator((raw: unknown): CreateCampaignInput => createCampaignInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = data.correlationId ?? newCorrelationId('campaign')

    return withIdempotency(data.idempotencyKey, actor.userId, 'createCampaign', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error } = await (supabaseAdmin as any).from('crm_campaigns').insert({
        organization_id: actor.organizationId,
        name: data.name, description: data.description ?? null,
        channel: data.channel, segment_id: data.segment_id ?? null,
        message_template: data.message_template, subject: data.subject ?? null,
        scheduled_at: data.scheduled_at ?? null,
        status: data.scheduled_at ? 'scheduled' : 'draft',
        created_by: actor.userId,
      }).select('id, code, status').single()
      if (error) throw new Error(error.message)
      await emit('CampaignCreated', { campaign_id: row.id, channel: data.channel, code: row.code }, correlation)
      if (row.status === 'scheduled') {
        await emit('CampaignScheduled', { campaign_id: row.id, scheduled_at: data.scheduled_at }, correlation)
      }
      await audit(actor, { action: 'campaign.create', resourceType: 'campaign', resourceId: row.id, payload: { code: row.code } })
      return { id: row.id as string, code: row.code as string, status: row.status as string, correlationId: correlation }
    })
  })

export const updateCampaign = createServerFn({ method: 'POST' })
  .validator((raw: unknown): UpdateCampaignInput => updateCampaignInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_campaigns').select('id, organization_id, status').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Campaign not found')
    if (['completed','cancelled','running'].includes(existing.status)) throw new Error(`Cannot edit a ${existing.status} campaign`)

    const patch: Record<string, unknown> = {}
    for (const k of ['name','description','segment_id','message_template','subject','scheduled_at'] as const) {
      if (data[k] !== undefined) patch[k] = data[k]
    }
    if (Object.keys(patch).length === 0) return { id: data.id }
    const { error } = await sb.from('crm_campaigns').update(patch).eq('id', data.id)
    if (error) throw new Error(error.message)
    await audit(actor, { action: 'campaign.update', resourceType: 'campaign', resourceId: data.id, payload: { patch } })
    return { id: data.id }
  })

export const scheduleCampaign = createServerFn({ method: 'POST' })
  .validator((raw: unknown): ScheduleCampaignInput => scheduleCampaignInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = data.correlationId ?? newCorrelationId('campaign-schedule')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_campaigns').select('id, organization_id, status').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Campaign not found')
    if (!isLegalTransition(existing.status, 'scheduled')) throw new Error(`Illegal transition ${existing.status} -> scheduled`)
    await sb.from('crm_campaigns').update({ scheduled_at: data.scheduled_at, status: 'scheduled' }).eq('id', data.id)
    await emit('CampaignScheduled', { campaign_id: data.id, scheduled_at: data.scheduled_at }, correlation)
    await audit(actor, { action: 'campaign.schedule', resourceType: 'campaign', resourceId: data.id, payload: { scheduled_at: data.scheduled_at } })
    return { id: data.id, correlationId: correlation }
  })

export const transitionCampaign = createServerFn({ method: 'POST' })
  .validator((raw: unknown): TransitionCampaignInput => transitionCampaignInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = data.correlationId ?? newCorrelationId('campaign-transition')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: existing } = await sb.from('crm_campaigns').select('id, organization_id, status').eq('id', data.id).maybeSingle()
    if (!existing || existing.organization_id !== actor.organizationId) throw new Error('Campaign not found')
    const { error } = await (supabaseAdmin.rpc as unknown as RpcFn)('crm_campaign_transition', {
      p_id: data.id, p_next: data.next,
    })
    if (error) throw new Error(error.message)
    const evName =
      data.next === 'running'   ? 'CampaignStarted'  :
      data.next === 'paused'    ? 'CampaignPaused'   :
      data.next === 'completed' ? 'CampaignCompleted':
      data.next === 'cancelled' ? 'CampaignCancelled':
      'CampaignTransitioned'
    await emit(evName, { campaign_id: data.id, from: existing.status, to: data.next }, correlation)
    await audit(actor, { action: `campaign.${data.next}`, resourceType: 'campaign', resourceId: data.id, payload: { from: existing.status, to: data.next } })
    return { id: data.id, status: data.next, correlationId: correlation }
  })

// ============ Start (dispatch) — resolves audience, delivers via adapters ============
export const startCampaign = createServerFn({ method: 'POST' })
  .validator((raw: unknown): StartCampaignInput => startCampaignInput.parse(raw))
  .handler(async ({ data }) => {
    const { getActor, requirePermission } = await import('./session.server')
    const { withIdempotency, newCorrelationId } = await import('./idempotency.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { audit } = await import('./audit.server')
    const { evaluateSegment } = await import('./segments/engine.server')
    const { getAdapter } = await import('./campaigns/adapters.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.write')
    const correlation = data.correlationId ?? newCorrelationId('campaign-start')

    return withIdempotency(data.idempotencyKey, actor.userId, 'startCampaign', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabaseAdmin as any
      const { data: c } = await sb.from('crm_campaigns').select('*').eq('id', data.id).maybeSingle()
      if (!c || c.organization_id !== actor.organizationId) throw new Error('Campaign not found')
      if (!isLegalTransition(c.status, 'running')) throw new Error(`Illegal transition ${c.status} -> running`)

      // Resolve audience from segment (or empty rules = all active).
      let customerIds: string[]
      if (c.segment_id) {
        const { data: seg } = await sb.from('crm_segments').select('rules, combinator').eq('id', c.segment_id).maybeSingle()
        customerIds = await evaluateSegment({
          organizationId: actor.organizationId,
          rules: (seg?.rules ?? []) as never,
          combinator: (seg?.combinator ?? 'and') as 'and' | 'or',
        })
      } else {
        const { data: all } = await sb.from('crm_customers').select('id')
          .eq('organization_id', actor.organizationId).eq('status', 'active')
        customerIds = ((all ?? []) as Array<{ id: string }>).map((r) => r.id)
      }

      // Filter unsubscribed + not opted-in for this channel.
      const [{ data: unsub }, { data: prefs }] = await Promise.all([
        sb.from('crm_unsubscribes').select('customer_id')
          .eq('organization_id', actor.organizationId).eq('channel', c.channel),
        sb.from('crm_contact_preferences').select('customer_id, opted_in')
          .eq('organization_id', actor.organizationId).eq('channel', c.channel),
      ])
      const excluded = new Set(((unsub ?? []) as Array<{ customer_id: string }>).map((u) => u.customer_id))
      for (const p of ((prefs ?? []) as Array<{ customer_id: string; opted_in: boolean }>)) {
        if (!p.opted_in) excluded.add(p.customer_id)
      }
      const targetIds = customerIds.filter((id) => !excluded.has(id))

      // Create run + transition state.
      const { data: run } = await sb.from('crm_campaign_runs').insert({
        organization_id: actor.organizationId, campaign_id: data.id,
        audience_size: targetIds.length,
      }).select('id').single()
      await (supabaseAdmin.rpc as unknown as RpcFn)('crm_campaign_transition', { p_id: data.id, p_next: 'running' })
      await sb.from('crm_campaigns').update({ audience_size: targetIds.length }).eq('id', data.id)
      await emit('CampaignStarted', { campaign_id: data.id, audience_size: targetIds.length, run_id: run.id }, correlation)

      // Load recipients meta.
      let sent = 0, failed = 0
      if (targetIds.length) {
        const { data: custs } = await sb.from('crm_customers')
          .select('id, full_name, phone, email').in('id', targetIds)
        const recipientRows = ((custs ?? []) as Array<{ id: string; full_name: string; phone: string | null; email: string | null }>)

        const adapter = getAdapter(c.channel)
        // Snapshot recipients (best-effort upsert).
        await sb.from('crm_campaign_recipients').insert(
          recipientRows.map((r) => ({
            organization_id: actor.organizationId, campaign_id: data.id,
            customer_id: r.id, channel: c.channel,
            address: c.channel === 'email' ? r.email : c.channel === 'sms' || c.channel === 'whatsapp' ? r.phone : r.id,
          })),
        )
        const { data: snapshot } = await sb.from('crm_campaign_recipients')
          .select('id, customer_id').eq('campaign_id', data.id)
        const idByCust = new Map<string, string>()
        for (const s of ((snapshot ?? []) as Array<{ id: string; customer_id: string }>)) idByCust.set(s.customer_id, s.id)

        // Deliver in small chunks, record events.
        for (const r of recipientRows) {
          const res = await adapter(c.message_template, c.subject, {
            customerId: r.id, fullName: r.full_name, email: r.email, phone: r.phone,
          })
          const recId = idByCust.get(r.id) ?? null
          await sb.from('crm_campaign_recipients').update({
            status: res.ok ? 'sent' : 'failed',
            sent_at: res.ok ? new Date().toISOString() : null,
            error: res.error ?? null,
          }).eq('id', recId)
          await sb.from('crm_campaign_events').insert({
            organization_id: actor.organizationId, campaign_id: data.id,
            recipient_id: recId, customer_id: r.id, channel: c.channel,
            kind: res.ok ? 'sent' : 'failed', provider_ref: res.providerRef,
            metadata: (res.error ? { error: res.error } : {}) as unknown as never,
          })
          if (res.ok) sent++; else failed++
        }
      }

      // Wrap up run + campaign.
      await sb.from('crm_campaign_runs').update({
        status: 'completed', finished_at: new Date().toISOString(),
        sent_count: sent, failed_count: failed,
      }).eq('id', run.id)
      await sb.from('crm_campaigns').update({
        sent_count: sent, failed_count: failed,
      }).eq('id', data.id)
      await (supabaseAdmin.rpc as unknown as RpcFn)('crm_campaign_transition', { p_id: data.id, p_next: 'completed' })
      await emit('CampaignCompleted', { campaign_id: data.id, sent, failed }, correlation)
      await audit(actor, { action: 'campaign.start', resourceType: 'campaign', resourceId: data.id, payload: { sent, failed, audience: targetIds.length } })

      return { runId: run.id as string, audience: targetIds.length, sent, failed, correlationId: correlation }
    })
  })
