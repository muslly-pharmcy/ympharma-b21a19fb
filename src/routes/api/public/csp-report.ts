// CSP violation report sink — routed through the shared public-endpoint
// guard (Wave C.7 · R0.2) so it inherits the same contract as every other
// /api/public/* POST: method + content-type allowlist, body cap, per-IP
// sliding-window rate limit, correlation id, structured admission log.
import { createFileRoute } from '@tanstack/react-router'
import { guardPublicRequest } from '@/lib/security/public-endpoint-guard.server'

export const Route = createFileRoute('/api/public/csp-report')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await guardPublicRequest(request, {
          route: 'csp-report',
          maxBytes: 16 * 1024,
          // Browsers may hit this endpoint aggressively during a bad
          // deploy; keep the window narrow but the ceiling relaxed.
          rateLimit: { windowMs: 60_000, max: 120 },
        })
        if (guard instanceof Response) return guard

        let parsed: unknown
        try {
          parsed = guard.body ? JSON.parse(guard.body) : null
        } catch {
          parsed = { raw: guard.body }
        }

        console.warn('[csp-report]', {
          correlationId: guard.correlationId,
          ua: request.headers.get('user-agent'),
          ct: guard.contentType,
          body: parsed,
        })
        return new Response(null, {
          status: 204,
          headers: { 'x-correlation-id': guard.correlationId },
        })
      },
    },
  },
})
