// Wave C — Enterprise Security Hardening
// Phase 1:   security headers + CSP Report-Only baseline.
// Phase 1.5: tightened directives, CSP report endpoint, `report-to` + `report-uri`.
// Nonce/hash-based script-src is documented as deferred — see
// docs/engineering/WAVE-C-SECURITY-HARDENING.md § "Nonce deferral rationale".
import { createMiddleware } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'

// Explicit third-party allowlist. Every entry is documented in the security
// doc under "Third-party inventory". Add new hosts here — never widen to `https:`.
const THIRD_PARTY_HOSTS = {
  // Lovable AI Gateway (server-side only, but connect-src covers browser paths too).
  lovableAi: 'https://ai.gateway.lovable.dev',
  // Google Fonts (if used by any future page). Kept explicit to avoid `https:` wildcard.
  googleFonts:   'https://fonts.googleapis.com',
  googleFontsStatic: 'https://fonts.gstatic.com',
  // Lovable component-tagger widget fonts (published deployments include the
  // Lovable badge which loads its variable icon font from cdn.gpteng.co).
  lovableCdn: 'https://cdn.gpteng.co',
} as const

function buildCsp(supabaseUrl: string | undefined, reportPath: string): string {
  const supaOrigin = supabaseUrl ? new URL(supabaseUrl).origin : ''
  const supaWs = supaOrigin ? supaOrigin.replace(/^http/, 'ws') : ''

  // Note: `'unsafe-inline'` remains on style-src/script-src while CSP is Report-Only.
  // Phase 1.5 tightens IMG/CONNECT/FONT away from `https:` catch-alls. Nonce migration
  // for scripts is deferred (see doc) — this policy is intentionally still permissive
  // for scripts and will be tightened once the framework-level nonce plumbing lands.
  const directives: Record<string, string[]> = {
    'default-src':      ["'self'"],
    'base-uri':         ["'self'"],
    'object-src':       ["'none'"],
    'frame-ancestors':  ["'none'"],
    'form-action':      ["'self'"],

    'img-src':          ["'self'", 'data:', 'blob:', ...(supaOrigin ? [supaOrigin] : [])],
    'font-src':         ["'self'", 'data:', THIRD_PARTY_HOSTS.googleFontsStatic, THIRD_PARTY_HOSTS.lovableCdn],
    'style-src':        ["'self'", "'unsafe-inline'", THIRD_PARTY_HOSTS.googleFonts],
    'script-src':       ["'self'", "'unsafe-inline'"], // Nonce migration deferred.
    'connect-src': [
      "'self'",
      ...(supaOrigin ? [supaOrigin, supaWs] : []),
      THIRD_PARTY_HOSTS.lovableAi,
    ],
    'worker-src':       ["'self'", 'blob:'],
    'media-src':        ["'self'", 'blob:', 'data:'],
    'manifest-src':     ["'self'"],

    // Reporting: legacy `report-uri` + modern `report-to` group.
    'report-uri':       [reportPath],
    'report-to':        ['csp-endpoint'],
    'upgrade-insecure-requests': [],
  }
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(' ')}` : k))
    .join('; ')
}

function reportToHeader(reportPath: string): string {
  return JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [{ url: reportPath }],
  })
}

export const securityHeadersMiddleware = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const reportPath = '/api/public/csp-report'
  const csp = buildCsp(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, reportPath)
  const headers: Record<string, string> = {
    // CSP in Report-Only mode: no enforcement, only violation reports.
    'Content-Security-Policy-Report-Only': csp,
    'Report-To': reportToHeader(reportPath),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'geolocation=(self)',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=(self)',
      'usb=()',
    ].join(', '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // HSTS: safe to always send; browsers ignore over plain HTTP.
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  }
  for (const [name, value] of Object.entries(headers)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setResponseHeader(name as any, value)
  }
  return next()
})
