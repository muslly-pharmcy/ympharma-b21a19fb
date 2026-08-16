import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

const GATEWAY = 'https://ai.gateway.lovable.dev/v1/videos'
const BUCKET = 'seedance-videos'

const StartInput = z.object({
  prompt: z.string().min(10).max(4000),
  aspectRatio: z.enum(['9:16', '16:9']),
  seconds: z.union([z.literal(4), z.literal(6), z.literal(8)]),
})

const PollInput = z.object({ jobId: z.string().min(3).max(120) })

function sizeFor(aspectRatio: '9:16' | '16:9') {
  return aspectRatio === '9:16' ? '720x1280' : '1280x720'
}

export const startSeedanceVideo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) throw new Error('AI gateway is not configured')

    const { supabase, userId } = context

    // Only one running job per user at a time (video is rate-limited and costly).
    const { data: running } = await supabase
      .from('seedance_generations')
      .select('job_id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .limit(1)

    if (running && running.length > 0) {
      return { jobId: running[0]!.job_id as string, alreadyRunning: true }
    }

    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/veo-3.1-lite',
        prompt: data.prompt,
        seconds: String(data.seconds),
        size: sizeFor(data.aspectRatio),
      }),
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { message?: string } | null
      const message =
        res.status === 429
          ? 'تم تجاوز حد الطلبات — انتظر قليلاً ثم أعد المحاولة.'
          : res.status === 402
            ? 'الرصيد غير كافٍ لتوليد الفيديو.'
            : (err?.message ?? 'تعذّر بدء توليد الفيديو.')
      throw new Error(message)
    }

    const job = (await res.json()) as { id: string }

    await supabase.from('seedance_generations').insert({
      user_id: userId,
      job_id: job.id,
      status: 'in_progress',
      prompt: data.prompt,
      aspect_ratio: data.aspectRatio,
      seconds: data.seconds,
    })

    return { jobId: job.id, alreadyRunning: false }
  })

export const pollSeedanceVideo = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => PollInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env['LOVABLE_API_KEY']
    if (!apiKey) throw new Error('AI gateway is not configured')

    const { supabase, userId } = context

    const { data: row } = await supabase
      .from('seedance_generations')
      .select('id, storage_path, status')
      .eq('job_id', data.jobId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!row) throw new Error('لم يتم العثور على مهمة التوليد.')

    // Already stored — just hand back a fresh signed URL.
    if (row.storage_path) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 3600)
      return { status: 'completed' as const, url: signed?.signedUrl ?? null, error: null }
    }

    const jobRes = await fetch(`${GATEWAY}/${data.jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const job = (await jobRes.json()) as {
      status: string
      progress?: number
      error?: { message?: string }
    }

    if (job.status === 'failed') {
      await supabase
        .from('seedance_generations')
        .update({ status: 'failed', error_message: job.error?.message ?? 'Generation failed' })
        .eq('id', row.id)
      return {
        status: 'failed' as const,
        url: null,
        error: job.error?.message ?? 'فشل توليد الفيديو.',
      }
    }

    if (job.status !== 'completed') {
      return {
        status: 'in_progress' as const,
        url: null,
        error: null,
        progress: job.progress ?? 0,
      }
    }

    const contentRes = await fetch(`${GATEWAY}/${data.jobId}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!contentRes.ok) throw new Error('تعذّر تنزيل الفيديو الناتج.')

    const bytes = await contentRes.arrayBuffer()
    const path = `${userId}/${data.jobId}.mp4`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'video/mp4', upsert: true })
    if (uploadError) throw new Error(uploadError.message)

    await supabase
      .from('seedance_generations')
      .update({ status: 'completed', storage_path: path })
      .eq('id', row.id)

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)

    return { status: 'completed' as const, url: signed?.signedUrl ?? null, error: null }
  })
