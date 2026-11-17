import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const shop = readFileSync(new URL('../src/routes/shop.tsx', import.meta.url), 'utf8')

describe('muslly.com ethical marketing copy', () => {
  it('does not present unconfirmed prices as current prices', () => {
    expect(shop).not.toContain('كتالوج شفاف بأسعار محدّثة')
    expect(shop).not.toContain('خيارات دفع مرنة')
    expect(shop).toContain('تأكيد السعر والتوفر')
  })

  it('describes local pharmacy order review without promising shipping outcomes', () => {
    expect(shop).toContain('مراجعة الطلب قبل التوصيل')
    expect(shop).not.toContain('خيارات شحن وتوصيل موثوقة')
  })
})
