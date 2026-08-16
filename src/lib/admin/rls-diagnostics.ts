export type VisibilityExpectation = 'anon-readable' | 'anon-hidden'

export interface RlsProbeResult {
  count: number | null
  error: { message: string } | null
}

export function didRlsProbePass(
  expectation: VisibilityExpectation,
  anon: RlsProbeResult,
  authenticated: RlsProbeResult,
): boolean {
  if (authenticated.error) return false
  if (expectation === 'anon-readable') return !anon.error

  // RLS normally hides rows by returning an empty result rather than 401/403.
  // A permission error is also acceptable for a deliberately private table.
  return Boolean(anon.error) || (anon.count ?? 0) === 0
}
