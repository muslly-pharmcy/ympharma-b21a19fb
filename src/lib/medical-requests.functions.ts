import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const submitSchema = z.object({
  full_name: z.string().trim().min(2, 'الاسم قصير جداً').max(120),
  phone: z.string().trim().min(5, 'رقم الهاتف غير صالح').max(40),
  request_type: z.enum(['medication', 'consultation', 'delivery', 'other']),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const submitMedicalRequest = createServerFn({ method: 'POST' })
  .validator((raw: unknown) => submitSchema.parse(raw))
  .handler(async ({ data }) => {
    const { getPublicSupabase } = await import('./supabase-public.server')
    const supabase = getPublicSupabase()

    const { data: row, error } = await supabase
      .from('medical_requests')
      .insert({
        full_name: data.full_name,
        phone: data.phone,
        request_type: data.request_type,
        note: data.note && data.note.length > 0 ? data.note : null,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[submitMedicalRequest]', error)
      throw new Error('تعذر إرسال الطلب. حاول مرة أخرى.')
    }

    // Best-effort email notification via transactional_emails queue.
    try {
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
      await supabaseAdmin.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: process.env.PHARMACY_INBOX_EMAIL ?? 'info@muslly.com',
          subject: `طلب جديد — ${data.request_type} — ${data.full_name}`,
          html: `<div dir="rtl" style="font-family:system-ui;line-height:1.7">
            <h2>طلب جديد من موقع صيدلية المصلي</h2>
            <p><b>الاسم:</b> ${escapeHtml(data.full_name)}</p>
            <p><b>الهاتف:</b> ${escapeHtml(data.phone)}</p>
            <p><b>نوع الطلب:</b> ${escapeHtml(data.request_type)}</p>
            <p><b>ملاحظات:</b><br/>${escapeHtml(data.note ?? '—')}</p>
          </div>`,
          template_name: 'medical_request',
        },
      })
    } catch (err) {
      console.warn('[submitMedicalRequest] email enqueue skipped', err)
    }

    // CRM bridge → Google Sheets (best effort).
    try {
      const { syncCrmEvent } = await import('@/lib/integrations/google-sheets/sync.server')
      void syncCrmEvent({
        source: 'inquiry',
        category: data.request_type === 'medication' ? 'طلب دواء' : data.request_type === 'consultation' ? 'استشارة' : data.request_type === 'delivery' ? 'توصيل' : 'أخرى',
        fullName: data.full_name,
        phone: data.phone,
        details: data.note && data.note.length > 0 ? data.note : 'بدون ملاحظات',
      })
    } catch {
      /* non-blocking */
    }

    return { id: row?.id as string, ok: true as const }
  })

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>')
}
