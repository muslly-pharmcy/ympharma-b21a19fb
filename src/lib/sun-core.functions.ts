import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

async function assertAdmin(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' })
  if (!isAdmin) {
    const { data: isOwner } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' })
    if (!isOwner) throw new Error('صلاحيات المدير مطلوبة')
  }
}

/** Planetary status board (last 24h). */
export const getPlanetaryStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never)
    const { planetaryStatus } = await import('@/lib/ai/runtime/telemetry.server')
    return planetaryStatus(24)
  })

/** Recent Google Sheets CRM sync rows. */
export const getCrmSyncLog = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never)
    const { data, error } = await context.supabase
      .from('crm_sync_log')
      .select('id, source, category, full_name, phone, details, status, attempts, error, created_at, synced_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return data ?? []
  })

/** Build today's executive report without sending it. */
export const previewDailyReport = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never)
    const { buildDailyReport, renderWhatsAppSummary, whatsappLink } = await import(
      '@/lib/reports/daily-dispatcher.server'
    )
    const report = await buildDailyReport()
    return { report, whatsappUrl: whatsappLink(renderWhatsAppSummary(report)) }
  })

/** Send the executive report now. */
export const sendDailyReportNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never)
    const { dispatchDailyReport } = await import('@/lib/reports/daily-dispatcher.server')
    const { report, emailQueued, whatsappUrl } = await dispatchDailyReport()
    return { emailQueued, whatsappUrl, sessions: report.visitors.sessions }
  })

const settingsSchema = z.object({
  spreadsheetId: z.string().trim().max(200).optional(),
  range: z.string().trim().max(100).optional(),
  webhookUrl: z.string().trim().url().max(500).or(z.literal('')).optional(),
})

/** Update the Google Sheets destination settings. */
export const updateSheetsSettings = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => settingsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const rows = [
      data.spreadsheetId !== undefined
        ? { key: 'google_sheets_spreadsheet_id', value: data.spreadsheetId as never }
        : null,
      data.range !== undefined ? { key: 'google_sheets_range', value: data.range as never } : null,
      data.webhookUrl !== undefined
        ? { key: 'google_sheets_webhook_url', value: (data.webhookUrl || null) as never }
        : null,
    ].filter(Boolean) as Array<{ key: string; value: never }>
    if (!rows.length) return { ok: true }
    const { error } = await supabaseAdmin.from('app_settings').upsert(rows, { onConflict: 'key' })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Read the current Google Sheets destination settings. */
export const getSheetsSettings = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never)
    const { data } = await context.supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['google_sheets_spreadsheet_id', 'google_sheets_range', 'google_sheets_webhook_url'])
    const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]))
    const str = (k: string) => (typeof map.get(k) === 'string' ? (map.get(k) as string) : '')
    return {
      spreadsheetId: str('google_sheets_spreadsheet_id'),
      range: str('google_sheets_range'),
      webhookUrl: str('google_sheets_webhook_url'),
    }
  })
