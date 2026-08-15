import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const testInput = z.object({
  phone: z.string().min(6).max(30),
  message: z.string().max(1000).optional().nullable(),
  templateName: z.string().min(1).max(120).optional().nullable(),
})

async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
) {
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' })
  if (data !== true) throw new Error('صلاحيات المدير مطلوبة')
}

export interface WhatsAppTestResult {
  ok: boolean
  messageId?: string
  error?: string
  code?: string
}

/**
 * Admin-only manual test send ("send-whatsapp-notification").
 * Sends a free-form text, or an approved template when `templateName` is given.
 */
export const sendWhatsAppNotification = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => testInput.parse(raw))
  .handler(async ({ data, context }): Promise<WhatsAppTestResult> => {
    await assertAdmin(context.supabase as never, context.userId)
    const { sendWhatsAppText, sendWhatsAppTemplate } = await import('./send.server')
    const result = data.templateName
      ? await sendWhatsAppTemplate(data.phone, data.templateName, 'ar')
      : await sendWhatsAppText(
          data.phone,
          data.message?.trim() ||
            'رسالة اختبار من صيدلية المصلي ✅ — نظام إشعارات واتساب يعمل بنجاح.',
        )
    return {
      ok: result.ok,
      ...(result.messageId ? { messageId: result.messageId } : {}),
      ...(result.error ? { error: result.error } : {}),
      ...(result.code ? { code: result.code } : {}),
    }
  })

/** Admin-only: is the WhatsApp integration configured on the server? */
export const getWhatsAppStatus = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId)
    const phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? ''
    return {
      configured: Boolean(process.env['WHATSAPP_ACCESS_TOKEN'] && phoneNumberId),
      phoneNumberId,
      wabaId: process.env['WHATSAPP_WABA_ID'] ?? '',
      graphVersion: 'v20.0',
    }
  })
