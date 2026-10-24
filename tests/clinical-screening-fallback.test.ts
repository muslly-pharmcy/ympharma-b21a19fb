import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScreeningSnapshot } from '@/domain/clinical-screening/schemas'
import { deterministicSummaryAr } from '@/domain/clinical-screening/schemas'

/**
 * The deterministic fallback is a hard requirement: a clinical workflow must
 * still complete when the AI provider is down, keyless, or times out.
 */
const mocks = vi.hoisted(() => ({
  getScreeningById: vi.fn(),
  callOpenAi: vi.fn(),
}))

vi.mock('../src/lib/clinical-screening.server', () => ({
  getScreeningById: mocks.getScreeningById,
}))

vi.mock('../src/lib/ai/provider.server', () => ({
  callOpenAi: mocks.callOpenAi,
  AiError: class AiError extends Error {},
}))

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  },
}))

const { summarizeScreening } = await import('../src/lib/clinical-screening-summary.server')

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  branchId: null,
  roles: [],
  orgRole: 'pharmacist',
  correlationId: 'corr-1',
  ip: null,
  userAgent: null,
}

function snapshot(overrides: Partial<ScreeningSnapshot> = {}): ScreeningSnapshot {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    organizationId: actor.organizationId,
    branchId: null,
    dispenseId: '44444444-4444-4444-8444-444444444444',
    prescriptionId: '55555555-5555-4555-8555-555555555555',
    patientId: '66666666-6666-4666-8666-666666666666',
    flow: 'dispense',
    providerId: 'local-db',
    providerName: 'Local DB',
    confidence: 'verified',
    highestSeverity: 'high',
    warningCount: 1,
    warnings: [
      {
        category: 'interaction',
        severity: 'high',
        code: 'DDI-TEST',
        message: 'تنبيه تجريبي',
        source: 'local-db',
      },
    ],
    inputHash: 'fnv1a-00000000-10',
    summaryAr: deterministicSummaryAr([
      {
        category: 'interaction',
        severity: 'high',
        code: 'DDI-TEST',
        message: 'تنبيه تجريبي',
        source: 'local-db',
      },
    ]),
    summarySource: 'deterministic',
    ranAt: new Date().toISOString(),
    override: null,
    correlationId: null,
    ...overrides,
  }
}

describe('summarizeScreening fallback', () => {
  beforeEach(() => {
    mocks.getScreeningById.mockReset()
    mocks.callOpenAi.mockReset()
  })

  it('returns the deterministic summary when the AI call fails', async () => {
    const screening = snapshot()
    mocks.getScreeningById.mockResolvedValue({ data: screening, error: null })
    mocks.callOpenAi.mockRejectedValue(new Error('missing_key'))

    const result = await summarizeScreening({ actor, screeningId: screening.id })
    expect(result.source).toBe('deterministic')
    expect(result.persisted).toBe(false)
    expect(result.summaryAr).toBe(screening.summaryAr)
  })

  it('falls back when the AI returns empty text', async () => {
    const screening = snapshot()
    mocks.getScreeningById.mockResolvedValue({ data: screening, error: null })
    mocks.callOpenAi.mockResolvedValue({ text: '   ' })

    const result = await summarizeScreening({ actor, screeningId: screening.id })
    expect(result.source).toBe('deterministic')
    expect(result.summaryAr).toBe(screening.summaryAr)
  })

  it('does not call the AI when there are no warnings', async () => {
    const screening = snapshot({ warnings: [], warningCount: 0, highestSeverity: null })
    mocks.getScreeningById.mockResolvedValue({ data: screening, error: null })

    const result = await summarizeScreening({ actor, screeningId: screening.id })
    expect(result.source).toBe('deterministic')
    expect(mocks.callOpenAi).not.toHaveBeenCalled()
  })

  it('returns the AI narrative and persists it on success', async () => {
    const screening = snapshot()
    mocks.getScreeningById.mockResolvedValue({ data: screening, error: null })
    mocks.callOpenAi.mockResolvedValue({ text: 'ملخص تجريبي' })

    const result = await summarizeScreening({ actor, screeningId: screening.id })
    expect(result.source).toBe('ai')
    expect(result.summaryAr).toBe('ملخص تجريبي')
    expect(result.persisted).toBe(true)
  })
})
