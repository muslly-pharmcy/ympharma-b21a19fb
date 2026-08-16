import { createServerFn } from '@tanstack/react-start'
import type { Campaign, Segment, CampaignRecipient, CampaignEvent } from '@/domain/crm/campaigns-schemas'

export const listCampaigns = createServerFn({ method: 'GET' })
  .validator((raw: unknown): { status?: string } => {
    const v = (raw ?? {}) as { status?: string }
    return { status: v.status }
  })
  .handler(async ({ data }): Promise<Campaign[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (supabaseAdmin as any).from('crm_campaigns').select('*')
      .eq('organization_id', actor.organizationId).order('created_at', { ascending: false }).limit(200)
    if (data.status && data.status !== 'all') q = q.eq('status', data.status)
    const { data: rows, error } = await q
    if (error) { console.error('[listCampaigns]', error); return [] }
    return (rows ?? []) as Campaign[]
  })

export const getCampaign = createServerFn({ method: 'GET' })
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data }): Promise<{
    campaign: Campaign
    recipients: CampaignRecipient[]
    events: CampaignEvent[]
    stats: { total: number; sent: number; delivered: number; failed: number; opened: number; clicked: number }
  } | null> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'campaign.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: c } = await sb.from('crm_campaigns').select('*')
      .eq('id', data.id).eq('organization_id', actor.organizationId).maybeSingle()
    if (!c) return null
    const [{ data: rec }, { data: ev }] = await Promise.all([
      sb.from('crm_campaign_recipients').select('*').eq('campaign_id', data.id).order('created_at', { ascending: false }).limit(500),
      sb.from('crm_campaign_events').select('*').eq('campaign_id', data.id).order('occurred_at', { ascending: false }).limit(200),
    ])
    const events = (ev ?? []) as CampaignEvent[]
    const stats = {
      total: (rec ?? []).length,
      sent: events.filter((e) => e.kind === 'sent').length,
      delivered: events.filter((e) => e.kind === 'delivered').length,
      failed: events.filter((e) => e.kind === 'failed').length,
      opened: events.filter((e) => e.kind === 'opened').length,
      clicked: events.filter((e) => e.kind === 'clicked').length,
    }
    return { campaign: c as Campaign, recipients: (rec ?? []) as CampaignRecipient[], events, stats }
  })

export const listSegments = createServerFn({ method: 'GET' })
  .handler(async (): Promise<Segment[]> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'segment.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from('crm_segments').select('*')
      .eq('organization_id', actor.organizationId).order('created_at', { ascending: false }).limit(200)
    if (error) { console.error('[listSegments]', error); return [] }
    return (data ?? []) as Segment[]
  })

export const getSegment = createServerFn({ method: 'GET' })
  .validator((raw: unknown): { id: string } => {
    const v = raw as { id?: string }
    if (!v?.id) throw new Error('id required')
    return { id: v.id }
  })
  .handler(async ({ data }): Promise<{ segment: Segment; members: Array<{ customer_id: string; full_name: string; code: string }> } | null> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const actor = await getActor()
    requirePermission(actor, 'segment.read')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin as any
    const { data: s } = await sb.from('crm_segments').select('*')
      .eq('id', data.id).eq('organization_id', actor.organizationId).maybeSingle()
    if (!s) return null
    const { data: mems } = await sb.from('crm_segment_memberships').select('customer_id')
      .eq('segment_id', data.id).limit(500)
    const ids = ((mems ?? []) as Array<{ customer_id: string }>).map((m) => m.customer_id)
    let members: Array<{ customer_id: string; full_name: string; code: string }> = []
    if (ids.length) {
      const { data: cust } = await sb.from('crm_customers').select('id, full_name, code').in('id', ids).limit(500)
      members = ((cust ?? []) as Array<{ id: string; full_name: string; code: string }>).map((c) => ({
        customer_id: c.id, full_name: c.full_name, code: c.code,
      }))
    }
    return { segment: s as Segment, members }
  })

export const previewSegment = createServerFn({ method: 'POST' })
  .validator(async (raw: unknown) => {
    const { previewSegmentInput } = await import('@/domain/crm/campaigns-commands')
    return previewSegmentInput.parse(raw)
  })
  .handler(async ({ data }): Promise<{ count: number; sample: Array<{ id: string; full_name: string; code: string }> }> => {
    const { getActor, requirePermission } = await import('./session.server')
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { evaluateSegment } = await import('./segments/engine.server')
    const actor = await getActor()
    requirePermission(actor, 'segment.read')
    const ids = await evaluateSegment({
      organizationId: actor.organizationId,
      rules: data.rules,
      combinator: data.combinator,
      limit: data.limit,
    })
    if (ids.length === 0) return { count: 0, sample: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cust } = await (supabaseAdmin as any).from('crm_customers')
      .select('id, full_name, code').in('id', ids.slice(0, 25))
    return { count: ids.length, sample: (cust ?? []) as Array<{ id: string; full_name: string; code: string }> }
  })
