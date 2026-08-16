// Daily executive report — compiled at 21:00 Asia/Aden and emailed to the owner,
// with a 1-click WhatsApp summary payload.

export interface DailyReport {
  dateLabel: string
  visitors: { sessions: number; newVisitors: number; avgDwellMinutes: number; topPages: Array<{ path: string; views: number }> }
  crm: { newCustomers: number; syncSynced: number; syncPending: number; syncFailed: number }
  sales: { orders: number; revenue: number; pendingPurchaseOrders: number; safetyStockAlerts: number }
  content: { generated: number; published: number; pending: number }
  storefront: { prescriptions: number; refills: number; bundleOrders: number; assistantMessages: number }
  health: { errors: number; degradedModules: string[] }

}

const REPORT_EMAIL = process.env['EXEC_REPORT_EMAIL'] ?? 'dr-mohmed@muslly.com'
const REPORT_WHATSAPP = process.env['EXEC_REPORT_WHATSAPP'] ?? '967782878280'

function dayWindow(): { fromIso: string; toIso: string; label: string } {
  const now = new Date()
  const from = new Date(now.getTime() - 24 * 3600_000)
  const label = new Intl.DateTimeFormat('ar-YE', { timeZone: 'Asia/Aden', dateStyle: 'full' }).format(now)
  return { fromIso: from.toISOString(), toIso: now.toISOString(), label }
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    console.warn('[daily-report] section failed', (e as Error).message)
    return fallback
  }
}

export async function buildDailyReport(): Promise<DailyReport> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { planetaryStatus } = await import('@/lib/ai/runtime/telemetry.server')
  const { fromIso, label } = dayWindow()

  const visitors = await safe(async () => {
    const { data } = await supabaseAdmin
      .from('visitor_sessions')
      .select('pages_viewed, first_visit, created_at, last_seen_at')
      .gte('last_seen_at', fromIso)
      .limit(5000)
    const rows = data ?? []
    const pageCount = new Map<string, number>()
    let dwellTotal = 0
    for (const r of rows) {
      const pages = Array.isArray(r.pages_viewed) ? (r.pages_viewed as unknown[]) : []
      for (const p of pages) {
        const path = typeof p === 'string' ? p : ((p as Record<string, unknown>)?.path as string) ?? null
        if (path) pageCount.set(path, (pageCount.get(path) ?? 0) + 1)
      }
      const start = new Date(r.created_at as string).getTime()
      const end = new Date(r.last_seen_at as string).getTime()
      if (end > start) dwellTotal += end - start
    }
    const topPages = Array.from(pageCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, views]) => ({ path, views }))
    return {
      sessions: rows.length,
      newVisitors: rows.filter((r) => r.first_visit).length,
      avgDwellMinutes: rows.length ? Math.round((dwellTotal / rows.length / 60000) * 10) / 10 : 0,
      topPages,
    }
  }, { sessions: 0, newVisitors: 0, avgDwellMinutes: 0, topPages: [] as Array<{ path: string; views: number }> })

  const crm = await safe(async () => {
    const [{ count: newCustomers }, synced, pending, failed] = await Promise.all([
      supabaseAdmin.from('crm_customers').select('id', { count: 'exact', head: true }).gte('created_at', fromIso),
      supabaseAdmin.from('crm_sync_log').select('id', { count: 'exact', head: true }).eq('status', 'synced').gte('created_at', fromIso),
      supabaseAdmin.from('crm_sync_log').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('crm_sync_log').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    ])
    return {
      newCustomers: newCustomers ?? 0,
      syncSynced: synced.count ?? 0,
      syncPending: pending.count ?? 0,
      syncFailed: failed.count ?? 0,
    }
  }, { newCustomers: 0, syncSynced: 0, syncPending: 0, syncFailed: 0 })

  const sales = await safe(async () => {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('total, created_at')
      .gte('created_at', fromIso)
      .limit(5000)
    const revenue = (orders ?? []).reduce((s, o) => s + Number(o.total ?? 0), 0)
    const [po, alerts] = await Promise.all([
      supabaseAdmin.from('invoice_uploads').select('id', { count: 'exact', head: true }).in('status', ['uploaded', 'extracting', 'extracted']),
      supabaseAdmin.from('inv_reorder_suggestions').select('id', { count: 'exact', head: true }).gte('created_at', fromIso),
    ])
    return {
      orders: orders?.length ?? 0,
      revenue: Math.round(revenue),
      pendingPurchaseOrders: po.count ?? 0,
      safetyStockAlerts: alerts.count ?? 0,
    }
  }, { orders: 0, revenue: 0, pendingPurchaseOrders: 0, safetyStockAlerts: 0 })

  const content = await safe(async () => {
    const { data } = await supabaseAdmin.from('social_posts').select('status').gte('created_at', fromIso).limit(500)
    const rows = data ?? []
    return {
      generated: rows.length,
      published: rows.filter((r) => r.status === 'published').length,
      pending: rows.filter((r) => r.status === 'pending').length,
    }
  }, { generated: 0, published: 0, pending: 0 })

  const storefront = await safe(async () => {
    const [rx, refills, bundles, events] = await Promise.all([
      supabaseAdmin.from('store_prescription_uploads').select('id', { count: 'exact', head: true }).gte('created_at', fromIso),
      supabaseAdmin.from('store_refill_subscriptions').select('id', { count: 'exact', head: true }).gte('created_at', fromIso),
      supabaseAdmin.from('store_bundle_orders').select('id', { count: 'exact', head: true }).gte('created_at', fromIso),
      supabaseAdmin.from('ai_widget_events').select('id', { count: 'exact', head: true }).eq('kind', 'assistant_message').gte('created_at', fromIso),
    ])
    return {
      prescriptions: rx.count ?? 0,
      refills: refills.count ?? 0,
      bundleOrders: bundles.count ?? 0,
      assistantMessages: events.count ?? 0,
    }
  }, { prescriptions: 0, refills: 0, bundleOrders: 0, assistantMessages: 0 })

  const health = await safe(async () => {
    const { count } = await supabaseAdmin.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', fromIso)
    const modules = await planetaryStatus(24)
    return {
      errors: count ?? 0,
      degradedModules: modules.filter((m) => m.status === 'degraded' || m.status === 'critical').map((m) => m.moduleKey),
    }
  }, { errors: 0, degradedModules: [] as string[] })

  return { dateLabel: label, visitors, crm, sales, content, storefront, health }

}

const CARD = 'background:#ffffff;border:1px solid #e2eeec;border-radius:16px;padding:16px;margin:0 0 12px'
const LABEL = 'color:#5b6b68;font-size:13px;margin:0 0 4px'
const VALUE = 'color:#0f3b36;font-size:22px;font-weight:700;margin:0'

function metric(label: string, value: string): string {
  return `<td style="padding:6px"><div style="${CARD}"><p style="${LABEL}">${label}</p><p style="${VALUE}">${value}</p></div></td>`
}

export function renderReportHtml(r: DailyReport): string {
  const pages = r.visitors.topPages.length
    ? r.visitors.topPages.map((p) => `<li style="margin:2px 0">${escapeHtml(p.path)} — ${p.views}</li>`).join('')
    : '<li>لا توجد بيانات</li>'
  const degraded = r.health.degradedModules.length ? r.health.degradedModules.join('، ') : 'كل الوحدات سليمة'

  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#D9EEEB;border-radius:20px;padding:20px;margin-bottom:16px">
      <h1 style="margin:0;font-size:20px;color:#0f3b36">التقرير التنفيذي اليومي</h1>
      <p style="margin:6px 0 0;color:#3c605b;font-size:14px">صيدلية المصلي · ${escapeHtml(r.dateLabel)}</p>
    </div>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">الزوار والتفاعل</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('الجلسات', String(r.visitors.sessions))}
      ${metric('زوار جدد', String(r.visitors.newVisitors))}
      ${metric('متوسط المكوث (د)', String(r.visitors.avgDwellMinutes))}
    </tr></table>
    <div style="${CARD}"><p style="${LABEL}">أكثر الصفحات زيارة</p><ul style="margin:6px 0 0;padding-inline-start:18px;color:#0f3b36;font-size:14px">${pages}</ul></div>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">العملاء ومزامنة Google Sheets</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('عملاء جدد', String(r.crm.newCustomers))}
      ${metric('صفوف تمت مزامنتها', String(r.crm.syncSynced))}
      ${metric('بانتظار/فشل', `${r.crm.syncPending} / ${r.crm.syncFailed}`)}
    </tr></table>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">المبيعات والمخزون</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('الطلبات', String(r.sales.orders))}
      ${metric('الإيراد', `${r.sales.revenue.toLocaleString('ar-YE')} ر.ي`)}
    </tr><tr>
      ${metric('فواتير شراء قيد المعالجة', String(r.sales.pendingPurchaseOrders))}
      ${metric('تنبيهات مخزون الأمان', String(r.sales.safetyStockAlerts))}
    </tr></table>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">المحتوى الصحي</h2>
    <div style="${CARD}"><p style="margin:0;color:#0f3b36;font-size:14px">تم توليد ${r.content.generated} منشوراً — نُشر ${r.content.published}، بانتظار النشر ${r.content.pending}.</p></div>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">طلبات المتجر</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('وصفات مرفوعة', String(r.storefront.prescriptions))}
      ${metric('تذكيرات تعبئة', String(r.storefront.refills))}
    </tr><tr>
      ${metric('طلبات باقات', String(r.storefront.bundleOrders))}
      ${metric('رسائل المساعد الذكي', String(r.storefront.assistantMessages))}
    </tr></table>


    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">صحة النظام</h2>
    <div style="${CARD}"><p style="margin:0;color:#0f3b36;font-size:14px">أخطاء الرصد خلال 24 ساعة: <b>${r.health.errors}</b><br/>حالة الوحدات: ${escapeHtml(degraded)}</p></div>

    <p style="color:#5b6b68;font-size:12px;margin-top:20px">تقرير تلقائي من نواة الشمس (Sun Core) — MUSLLY AI OS.</p>
  </div></body></html>`
}

export function renderWhatsAppSummary(r: DailyReport): string {
  const lines = [
    `📊 التقرير اليومي — صيدلية المصلي`,
    `🗓 ${r.dateLabel}`,
    `👥 جلسات: ${r.visitors.sessions} (جدد ${r.visitors.newVisitors}) — مكوث ${r.visitors.avgDwellMinutes} د`,
    `🧾 طلبات: ${r.sales.orders} — إيراد ${r.sales.revenue.toLocaleString('ar-YE')} ر.ي`,
    `🧑‍⚕️ عملاء جدد: ${r.crm.newCustomers} — مزامنة Sheets: ${r.crm.syncSynced}`,
    `📦 تنبيهات مخزون: ${r.sales.safetyStockAlerts} — فواتير قيد المعالجة: ${r.sales.pendingPurchaseOrders}`,
    `📝 منشورات صحية: ${r.content.generated}`,
    `💊 وصفات: ${r.storefront.prescriptions} — تعبئة: ${r.storefront.refills} — باقات: ${r.storefront.bundleOrders}`,

    `⚙️ أخطاء: ${r.health.errors}`,
  ]
  return lines.join('\n')
}

export function whatsappLink(summary: string, phone = REPORT_WHATSAPP): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
}

/** Build + enqueue the executive email. Returns the report and WhatsApp link. */
export async function dispatchDailyReport(): Promise<{
  report: DailyReport
  emailQueued: boolean
  whatsappUrl: string
}> {
  const report = await buildDailyReport()
  const html = renderReportHtml(report)
  const summary = renderWhatsAppSummary(report)

  let emailQueued = false
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: REPORT_EMAIL,
        subject: `التقرير التنفيذي اليومي — ${report.dateLabel}`,
        html,
        template_name: 'daily_executive_report',
      },
    })
    emailQueued = !error
    if (error) console.error('[daily-report] enqueue failed', error.message)
  } catch (e) {
    console.error('[daily-report] enqueue threw', (e as Error).message)
  }

  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('executive_reports').insert({ payload: report as never } as never)
  } catch {
    /* optional archive */
  }

  return { report, emailQueued, whatsappUrl: whatsappLink(summary) }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
