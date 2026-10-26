import { createFileRoute } from '@tanstack/react-router'
import { getPublicSupabase } from '@/lib/supabase-public.server'

export const Route = createFileRoute('/api/public/health')({
  server: { handlers: { GET: async () => {
    try {
      const { error } = await getPublicSupabase().from('catalog_products').select('id').limit(1).abortSignal(AbortSignal.timeout(5000))
      return Response.json({ status: error ? 'unavailable' : 'ready' }, {
        status: error ? 503 : 200, headers: { 'cache-control': 'no-store' },
      })
    } catch {
      return Response.json({ status: 'unavailable' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
  } } },
})
