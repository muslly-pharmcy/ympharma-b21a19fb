/**
 * Optional Windows-only Tesseract OCR preview for invoice images.
 * This does not parse financial values or create stock, draft POs or journals.
 *
 * Server-side only: OCR bridge is bound to 127.0.0.1 on the Windows host.
 * Cloudflare Workers cannot access a user's D: drive or their localhost.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { assertOwnVisionObject } from './vision-storage-policy'

const MAX_BYTES = 8_000_000
const BRIDGE_URL = 'http://127.0.0.1:47861/ocr'

type OcrPreview =
  | { ok: true; rawText: string; engine: 'tesseract-local'; requiresReview: true }
  | { ok: false; error: string }

export const analyzeLocalOcrInvoice = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ storagePath: z.string().min(38).max(500) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<OcrPreview> => {
    // Private object ownership is checked *before* service-role storage reads.
    assertOwnVisionObject(context.userId, 'invoice-uploads', data.storagePath)
    const [{ data: isAdmin }, { data: isOwner }] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'owner' }),
    ])
    if (isAdmin !== true && isOwner !== true) {
      throw new Error('صلاحيات المدير مطلوبة لقراءة الفاتورة')
    }

    // Never attempt to route cloud/serverless requests to a private Windows PC.
    if (typeof process === 'undefined' || process.platform !== 'win32') {
      return { ok: false, error: 'OCR المحلي يعمل فقط عندما يكون خادم يام فارما على جهاز Windows المتصل بمحرك D.' }
    }
    const token = process.env.YMPHARMA_LOCAL_OCR_TOKEN
    if (!token || token.length < 32) {
      return { ok: false, error: 'لم تُهيّأ خدمة OCR المحلية في خادم يام فارما' }
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: image, error } = await supabaseAdmin.storage
      .from('invoice-uploads')
      .download(data.storagePath)
    if (error || !image) return { ok: false, error: 'تعذّر قراءة صورة الفاتورة الخاصة بك' }
    if (!image.size || image.size > MAX_BYTES) {
      return { ok: false, error: 'الصورة تتجاوز حد 8 ميجابايت' }
    }

    const binary = await image.arrayBuffer()
    const prefix = new Uint8Array(binary, 0, Math.min(8, binary.byteLength))
    const jpeg = prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff
    const png = prefix.length >= 8
      && prefix[0] === 0x89 && prefix[1] === 0x50 && prefix[2] === 0x4e && prefix[3] === 0x47
      && prefix[4] === 0x0d && prefix[5] === 0x0a && prefix[6] === 0x1a && prefix[7] === 0x0a
    if (!jpeg && !png) return { ok: false, error: 'يدعم OCR المحلي صور JPG وPNG فقط' }

    try {
      const response = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': jpeg ? 'image/jpeg' : 'image/png',
        },
        body: binary,
        signal: AbortSignal.timeout(40_000),
      })
      if (!response.ok) return { ok: false, error: 'تعذّر تشغيل محرك OCR المحلي؛ تحقق من خدمة Windows' }
      const payload = z.object({
        ok: z.literal(true),
        rawText: z.string().max(12000),
      }).safeParse(await response.json())
      if (!payload.success) return { ok: false, error: 'استجابة OCR المحلي غير صالحة' }
      return { ok: true, rawText: payload.data.rawText, engine: 'tesseract-local', requiresReview: true }
    } catch {
      return { ok: false, error: 'خدمة OCR المحلية غير متصلة. لم تُسجّل أي بيانات مالية.' }
    }
  })
