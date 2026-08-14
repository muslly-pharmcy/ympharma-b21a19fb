import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'

// Daily job: generate 3 medical/health tip posts using Lovable AI Gateway
// and queue them into `social_posts` (facebook). Public hook, protected by
// a shared CRON_SECRET header (never the public anon key).
export const Route = createFileRoute('/api/public/hooks/generate-social-posts')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get('x-cron-secret') ?? ''
        const expected = process.env.CRON_SECRET ?? ''
        if (!expected) return new Response('cron secret not configured', { status: 500 })
        const a = Buffer.from(provided)
        const b = Buffer.from(expected)
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response('unauthorized', { status: 401 })
        }


        const key = process.env.LOVABLE_API_KEY
        if (!key) return new Response('missing LOVABLE_API_KEY', { status: 500 })

        const prompt = `أنت مسؤول المحتوى الطبي لصيدلية المصلي في عدن. أنشئ 3 منشورات قصيرة (كل منشور 2-3 جمل) لصفحة فيسبوك تحوي نصيحة صحية أو دوائية عملية للجمهور اليمني، بأسلوب ودّي ومهني. أرجع JSON فقط بالشكل التالي:
{"posts":[{"caption":"...","hashtags":["#صحة","#صيدلية_المصلي"],"cta":"..."}]}`

        let posts: Array<{ caption: string; hashtags: string[]; cta?: string }> = []
        try {
          const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'You produce JSON only, no markdown fences.' },
                { role: 'user', content: prompt },
              ],
              response_format: { type: 'json_object' },
            }),
          })
          if (!r.ok) {
            const body = await r.text()
            const { classifyAiFailure } = await import('@/lib/ai/error-classify')
            const { recordAiCall } = await import('@/lib/ai/observability.server')
            const klass = classifyAiFailure(r.status, body)
            void recordAiCall({
              feature: 'social-posts-cron',
              model: 'google/gemini-3-flash-preview',
              backend: 'gateway',
              ok: false,
              errorClass: klass,
            })
            console.error('[social-posts] gateway error', klass, r.status)
            return new Response(JSON.stringify({ ok: false, error: klass }), { status: 502 })
          }
          const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> }
          const text = data.choices?.[0]?.message?.content ?? '{"posts":[]}'
          const parsed = JSON.parse(text) as { posts?: typeof posts }
          posts = Array.isArray(parsed.posts) ? parsed.posts.slice(0, 3) : []
        } catch (e) {
          const { classifyThrownAi } = await import('@/lib/ai/error-classify')
          const { recordAiCall } = await import('@/lib/ai/observability.server')
          const klass = classifyThrownAi(e)
          void recordAiCall({
            feature: 'social-posts-cron',
            model: 'google/gemini-3-flash-preview',
            backend: 'gateway',
            ok: false,
            errorClass: klass,
          })
          console.error('[social-posts] failed', klass)
          return new Response(JSON.stringify({ ok: false, error: klass }), { status: 500 })
        }

        if (posts.length === 0) {
          return Response.json({ ok: true, inserted: 0, note: 'model returned no posts' })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const rows = posts.map((p, i) => ({
          platform: 'facebook',
          caption: p.caption,
          hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
          cta: p.cta ?? null,
          status: 'pending',
          scheduled_for: new Date(Date.now() + (i + 1) * 90 * 60_000).toISOString(),
        }))
        const { error, data } = await supabaseAdmin
          .from('social_posts')
          .insert(rows)
          .select('id')
        if (error) {
          console.error('[social-posts] insert failed', error)
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
        }
        return Response.json({ ok: true, inserted: data?.length ?? 0 })
      },
    },
  },
})
