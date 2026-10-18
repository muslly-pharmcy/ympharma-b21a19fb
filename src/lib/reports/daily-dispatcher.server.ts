import {acknowledgedQueueId,completeRows,exactCount,exactOrderTotal,reportRecipient,configuredWhatsAppLink} from './report-source'

export interface DailyReport {
 dateLabel:string
 source:{from:string;to:string;generatedAt:string;window:'rolling_24_hours';consistency:'independent_source_reads';salesBasis:'order_face_values_not_accounting_revenue';currency:'unverified';visitorsBasis:'recently_seen_records_clipped_span_not_active_dwell';pagesBasis:'lifetime_pages_of_selected_records'}
 visitors:{sessions:number;newVisitors:number;avgDwellMinutes:number;topPages:Array<{path:string;views:number}>}
 crm:{newCustomers:number;syncSynced:number;syncPending:number;syncFailed:number}
 sales:{orders:number;orderTotal:string;pendingPurchaseOrders:number;safetyStockAlerts:number}
 content:{generated:number;published:number;pending:number}
 storefront:{prescriptions:number;refills:number;bundleOrders:number;assistantMessages:number}
 health:{errors:number;degradedModules:string[];unobservedModules:string[]}
}

/** Read-only report. A failed/truncated source rejects the report rather than fabricating zeros. */
export async function buildDailyReport():Promise<DailyReport>{
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server')
 const {planetaryStatus}=await import('@/lib/ai/runtime/telemetry.server')
 const end=new Date(),to=end.toISOString(),from=new Date(end.getTime()-24*3600_000).toISOString()
 const dateLabel=new Intl.DateTimeFormat('ar-YE',{timeZone:'Asia/Aden',dateStyle:'full'}).format(end)
 const [visitorResult,customers,synced,pending,failed,ordersResult,purchases,alerts,postsResult,rx,refills,bundles,messages,errors,modules]=await Promise.all([
  db.from('visitor_sessions').select('pages_viewed, first_visit, created_at, last_seen_at',{count:'exact'}).gte('last_seen_at',from).lt('last_seen_at',to).limit(5000),
  db.from('crm_customers').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  db.from('crm_sync_log').select('id',{count:'exact',head:true}).eq('status','synced').gte('created_at',from).lt('created_at',to),
  db.from('crm_sync_log').select('id',{count:'exact',head:true}).eq('status','pending').lt('created_at',to),
  db.from('crm_sync_log').select('id',{count:'exact',head:true}).eq('status','failed').lt('created_at',to),
  db.from('orders').select('total, created_at',{count:'exact'}).gte('created_at',from).lt('created_at',to).limit(5000),
  db.from('invoice_uploads').select('id',{count:'exact',head:true}).in('status',['uploaded','extracting','extracted']).lt('created_at',to),
  db.from('inv_reorder_suggestions').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  db.from('social_posts').select('status',{count:'exact'}).gte('created_at',from).lt('created_at',to).limit(500),
  db.from('store_prescription_uploads').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  db.from('store_refill_subscriptions').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  db.from('store_bundle_orders').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  db.from('ai_widget_events').select('id',{count:'exact',head:true}).eq('kind','assistant_message').gte('created_at',from).lt('created_at',to),
  db.from('error_logs').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
  planetaryStatus(24,end),
 ])
 const visitors=completeRows(visitorResult),orders=completeRows(ordersResult),posts=completeRows(postsResult)
 const pageCount=new Map<string,number>();let dwell=0
 for(const r of visitors){
  if(!Array.isArray(r.pages_viewed)||typeof r.first_visit!=='boolean')throw Error('REPORT_INVALID_VISITOR_SOURCE');
  for(const value of r.pages_viewed){const page=typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.path:null;if(typeof page!=='string'||!page)throw Error('REPORT_INVALID_VISITOR_SOURCE');pageCount.set(page,(pageCount.get(page)??0)+1)}
  const start=typeof r.created_at==='string'?Date.parse(r.created_at):NaN,last=typeof r.last_seen_at==='string'?Date.parse(r.last_seen_at):NaN;if(!Number.isFinite(start)||!Number.isFinite(last)||last<start||last<Date.parse(from)||last>=end.getTime())throw Error('REPORT_INVALID_SOURCE_DATE');dwell+=last-Math.max(start,Date.parse(from))
 }
 return {dateLabel,source:{from,to,generatedAt:new Date().toISOString(),window:'rolling_24_hours',consistency:'independent_source_reads',salesBasis:'order_face_values_not_accounting_revenue',currency:'unverified',visitorsBasis:'recently_seen_records_clipped_span_not_active_dwell',pagesBasis:'lifetime_pages_of_selected_records'},
  visitors:{sessions:visitors.length,newVisitors:visitors.filter(r=>r.first_visit&&Date.parse(r.created_at)>=Date.parse(from)).length,avgDwellMinutes:visitors.length?Math.round(dwell/visitors.length/6000)/10:0,topPages:[...pageCount].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([path,views])=>({path,views}))},
  crm:{newCustomers:exactCount(customers),syncSynced:exactCount(synced),syncPending:exactCount(pending),syncFailed:exactCount(failed)},
  sales:{orders:orders.length,orderTotal:exactOrderTotal(orders.map(o=>o.total)),pendingPurchaseOrders:exactCount(purchases),safetyStockAlerts:exactCount(alerts)},
  content:{generated:posts.length,published:posts.filter(p=>p.status==='published').length,pending:posts.filter(p=>p.status==='pending').length},
  storefront:{prescriptions:exactCount(rx),refills:exactCount(refills),bundleOrders:exactCount(bundles),assistantMessages:exactCount(messages)},
  health:{errors:exactCount(errors),degradedModules:modules.filter(m=>m.status==='degraded'||m.status==='critical').map(m=>m.moduleKey),unobservedModules:modules.filter(m=>m.status==='idle'||!m.lastSeen).map(m=>m.moduleKey)},
 }
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
  const degraded = r.health.degradedModules.length ? r.health.degradedModules.join('، ') : r.health.unobservedModules.length ? 'لا توجد قياسات كافية لكل الوحدات' : 'لم تظهر وحدات متدهورة ضمن القياسات المتاحة'

  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#ffffff;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#D9EEEB;border-radius:20px;padding:20px;margin-bottom:16px">
      <h1 style="margin:0;font-size:20px;color:#0f3b36">التقرير التنفيذي اليومي</h1>
      <p style="margin:6px 0 0;color:#3c605b;font-size:14px">صيدلية المصلي · ${escapeHtml(r.dateLabel)}</p><p>آخر24ساعة: ${escapeHtml(r.source.from)} إلى ${escapeHtml(r.source.to)}. قراءة مصادر مستقلة وليست لقطة محاسبية واحدة. عملة قيم الطلبات غير موثقة في هذا المصدر. مدة الزائر هي الفاصل المرصود داخل الفترة وليست زمن التفاعل الفعلي.</p>
    </div>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">الزوار والتفاعل</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('سجلات زوار نشطة', String(r.visitors.sessions))}
      ${metric('زوار جدد', String(r.visitors.newVisitors))}
      ${metric('متوسط المدة المرصودة داخل الفترة (د)', String(r.visitors.avgDwellMinutes))}
    </tr></table>
    <div style="${CARD}"><p style="${LABEL}">صفحات محفوظة في سجلات الزوار — قد تشمل زيارات أقدم</p><ul style="margin:6px 0 0;padding-inline-start:18px;color:#0f3b36;font-size:14px">${pages}</ul></div>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">العملاء ومزامنة Google Sheets</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('عملاء جدد', String(r.crm.newCustomers))}
      ${metric('صفوف تمت مزامنتها', String(r.crm.syncSynced))}
      ${metric('بانتظار/فشل', `${r.crm.syncPending} / ${r.crm.syncFailed}`)}
    </tr></table>

    <h2 style="font-size:15px;color:#0f3b36;margin:16px 0 6px">المبيعات والمخزون</h2>
    <table width="100%" cellspacing="0" cellpadding="0"><tr>
      ${metric('الطلبات', String(r.sales.orders))}
      ${metric('مجموع قيم الطلبات — ليس إيرادًا محاسبيًا', escapeHtml(r.sales.orderTotal))}
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
    `🗓 ${r.dateLabel} — آخر24ساعة: ${r.source.from} إلى ${r.source.to}`,
    `👥 سجلات زوار: ${r.visitors.sessions} (جدد ${r.visitors.newVisitors}) — مدة مرصودة ${r.visitors.avgDwellMinutes} د (ليست زمن تفاعل فعلي)`,
    `🧾 طلبات: ${r.sales.orders} — مجموع قيمها: ${r.sales.orderTotal} (ليس إيرادًا محاسبيًا؛ العملة غير موثقة في هذا المصدر)`,
    `🧑‍⚕️ عملاء جدد: ${r.crm.newCustomers} — مزامنة Sheets: ${r.crm.syncSynced}`,
    `📦 تنبيهات مخزون: ${r.sales.safetyStockAlerts} — فواتير قيد المعالجة: ${r.sales.pendingPurchaseOrders}`,
    `📝 منشورات صحية: ${r.content.generated}`,
    `💊 وصفات: ${r.storefront.prescriptions} — تعبئة: ${r.storefront.refills} — باقات: ${r.storefront.bundleOrders}`,

    `⚙️ أخطاء: ${r.health.errors} — وحدات بلا قياسات: ${r.health.unobservedModules.length}`,
  ]
  return lines.join('\n')
}

export function whatsappLink(summary: string, phone = process.env['EXEC_REPORT_WHATSAPP']): string {
  return configuredWhatsAppLink(summary,phone)
}

/** Build + enqueue the executive email. Returns the report and WhatsApp link. */
export async function dispatchDailyReport(): Promise<{
  report: DailyReport
  emailQueued: boolean
  whatsappUrl: string
}> {
  const recipient=reportRecipient(process.env)
  const report = await buildDailyReport()
  const html = renderReportHtml(report)
  const summary = renderWhatsAppSummary(report)
  const whatsappUrl = whatsappLink(summary)

  let emailQueued = false
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: recipient,
        subject: `التقرير التنفيذي اليومي — ${report.dateLabel}`,
        html,
        template_name: 'daily_executive_report',
      },
    })
    emailQueued = !error && acknowledgedQueueId(data)
    if (!emailQueued) console.error('[daily-report] queue acknowledgment unconfirmed')
  } catch {
    console.error('[daily-report] queue acknowledgment unavailable')
  }

  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('executive_reports').insert({ payload: report as never } as never)
  } catch {
    /* optional archive */
  }

  return { report, emailQueued, whatsappUrl }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
