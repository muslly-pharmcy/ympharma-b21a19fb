// CRM → Google Sheets sync bridge.
// Every event is logged in public.crm_sync_log first (durable), then pushed.
// Failures stay `pending` and are retried by the hourly cron hook.

import { appendSheetRow, DEFAULT_SHEET_RANGE, DEFAULT_SPREADSHEET_ID, type SheetRow } from './client.server'

export type CrmSource = 'registration' | 'order' | 'inquiry' | 'whatsapp'

export interface CrmSyncEvent extends SheetRow {
  source: CrmSource
}

interface SheetsConfig {
  spreadsheetId: string
  range: string
  webhookUrl: string | null
}

async function loadConfig(): Promise<SheetsConfig> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['google_sheets_spreadsheet_id', 'google_sheets_range', 'google_sheets_webhook_url'])
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]))
    const str = (k: string) => {
      const v = map.get(k)
      if (typeof v === 'string') return v
      if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
        const inner = (v as Record<string, unknown>).value
        return typeof inner === 'string' ? inner : null
      }
      return null
    }
    return {
      spreadsheetId: str('google_sheets_spreadsheet_id') || DEFAULT_SPREADSHEET_ID,
      range: str('google_sheets_range') || DEFAULT_SHEET_RANGE,
      webhookUrl: str('google_sheets_webhook_url'),
    }
  } catch {
    return { spreadsheetId: DEFAULT_SPREADSHEET_ID, range: DEFAULT_SHEET_RANGE, webhookUrl: null }
  }
}

/** Fire-and-forget CRM sync. Never throws — callers stay unaffected. */
export async function syncCrmEvent(event: CrmSyncEvent): Promise<{ logged: boolean; synced: boolean }> {
  let logId: string | null = null
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('crm_sync_log')
      .insert({
        source: event.source,
        category: event.category,
        full_name: event.fullName,
        phone: event.phone,
        details: event.details,
        payload: { ...event },
        status: 'pending',
      })
      .select('id')
      .single()
    logId = (data?.id as string) ?? null

    const cfg = await loadConfig()
    const res = await appendSheetRow(event, cfg)

    if (logId) {
      await supabaseAdmin
        .from('crm_sync_log')
        .update({
          status: res.ok ? 'synced' : 'pending',
          attempts: 1,
          error: res.ok ? null : res.error ?? `HTTP ${res.status}`,
          synced_at: res.ok ? new Date().toISOString() : null,
        })
        .eq('id', logId)
    }
    return { logged: Boolean(logId), synced: res.ok }
  } catch (e) {
    console.warn('[crm-sync] skipped', (e as Error).message)
    return { logged: Boolean(logId), synced: false }
  }
}

/** Retry pending rows (hourly cron). Returns counts. */
export async function retryPendingCrmSync(limit = 50): Promise<{ retried: number; synced: number; failed: number }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data, error } = await supabaseAdmin
    .from('crm_sync_log')
    .select('id, payload, attempts')
    .eq('status', 'pending')
    .lt('attempts', 6)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error || !data?.length) return { retried: 0, synced: 0, failed: 0 }

  const cfg = await loadConfig()
  let synced = 0
  let failed = 0

  for (const row of data) {
    const payload = (row.payload ?? {}) as Partial<CrmSyncEvent>
    const res = await appendSheetRow(
      {
        fullName: payload.fullName ?? '—',
        phone: payload.phone ?? '—',
        details: payload.details ?? '—',
        category: payload.category ?? 'عام',
        at: payload.at,
      },
      cfg,
    )
    const attempts = (row.attempts as number) + 1
    if (res.ok) synced++
    else failed++
    await supabaseAdmin
      .from('crm_sync_log')
      .update({
        attempts,
        status: res.ok ? 'synced' : attempts >= 6 ? 'failed' : 'pending',
        error: res.ok ? null : res.error ?? `HTTP ${res.status}`,
        synced_at: res.ok ? new Date().toISOString() : null,
      })
      .eq('id', row.id as string)
  }

  return { retried: data.length, synced, failed }
}

/**
 * Backfill new customer registrations that were not synced yet.
 * Runs on the hourly cron so registrations created by DB triggers are covered.
 */
export async function syncNewRegistrations(sinceHours = 48, limit = 50): Promise<{ synced: number }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString()

  const { data: customers } = await supabaseAdmin
    .from('crm_customers')
    .select('id, full_name, phone, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!customers?.length) return { synced: 0 }

  const { data: logged } = await supabaseAdmin
    .from('crm_sync_log')
    .select('payload')
    .eq('source', 'registration')
    .gte('created_at', since)
    .limit(500)
  const seen = new Set(
    (logged ?? [])
      .map((r) => ((r.payload ?? {}) as Record<string, unknown>).customerId)
      .filter((v): v is string => typeof v === 'string'),
  )

  let synced = 0
  for (const c of customers) {
    if (seen.has(c.id as string)) continue
    const res = await syncCrmEvent({
      source: 'registration',
      category: 'عميل جديد',
      fullName: (c.full_name as string) ?? '—',
      phone: (c.phone as string) ?? '—',
      details: 'تسجيل عميل جديد',
      at: c.created_at as string,
      // carried in payload for dedupe
      ...({ customerId: c.id } as Record<string, unknown>),
    } as never)
    if (res.synced) synced++
  }
  return { synced }
}
