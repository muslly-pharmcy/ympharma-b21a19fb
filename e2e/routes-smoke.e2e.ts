import { expect, test } from '@playwright/test'

const publicRoutes = [
  '/',
  '/about',
  '/ai-chat',
  '/auth',
  '/contact',
  '/delivery/aden',
  '/guides/',
  '/mission-control',
  '/offline',
  '/request',
  '/reset-password',
  '/search',
  '/shop',
  '/tools/',
  '/tools/bmi',
  '/tools/interactions',
  '/tools/pediatric-dose',
  '/tools/schedule',
  '/tools/symptoms',
  '/unsubscribe',
]

const protectedRoutes = [
  '/admin-diagnostics',
  '/admin-inventory',
  '/cart',
  '/checkout',
  '/control-tower',
  '/doctors',
  '/medical-directory',
  '/orders',
  '/patients',
  '/prescriptions',
  '/store',
]

test.describe('route smoke coverage', () => {
  test('all static views render or redirect to auth without fatal errors', async ({ page }) => {
    const pageErrors: string[] = []
    const bridgeErrors: string[] = []

    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /(capacitor|pushnotifications|firebase|missing supabase|hydration failed)/i.test(
          message.text(),
        )
      ) {
        bridgeErrors.push(message.text())
      }
    })

    for (const route of [...publicRoutes, ...protectedRoutes]) {
      pageErrors.length = 0
      bridgeErrors.length = 0

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })
      expect(response, `${route} should return a document response`).not.toBeNull()
      expect(response!.status(), `${route} should not return an HTTP error`).toBeLessThan(400)

      await expect(page.locator('body')).not.toBeEmpty()
      await expect(page.locator('body')).not.toContainText(
        /missing supabase environment|application error|internal server error/i,
      )
      expect(pageErrors, `${route} should not throw an uncaught browser error`).toEqual([])
      expect(bridgeErrors, `${route} should not report a native bridge error`).toEqual([])
    }
  })
})
