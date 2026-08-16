import { describe, it, expect } from 'vitest'
import type { ExecutiveKpis, SeriesPoint } from '@/lib/analytics.functions'

/** Contract tests for analytics DTOs — ensures shape stability for the executive dashboard. */
describe('analytics DTO shape', () => {
  it('ExecutiveKpis includes all required KPI fields', () => {
    const kpis: ExecutiveKpis = {
      dispenses_today: 0, dispenses_7d: 0, dispenses_30d: 0,
      new_customers_7d: 0, active_customers_30d: 0,
      loyalty_points_earned_30d: 0, loyalty_points_redeemed_30d: 0,
      campaigns_active: 0, ai_runs_24h: 0,
      low_stock_items: 0, expiring_soon_items: 0,
      as_of: new Date().toISOString(),
    }
    expect(Object.keys(kpis)).toHaveLength(12)
    expect(kpis.as_of).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('SeriesPoint has date+value only', () => {
    const p: SeriesPoint = { date: '2026-07-20', value: 42 }
    expect(p.date).toBe('2026-07-20')
    expect(p.value).toBe(42)
  })
})
