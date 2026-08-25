import { expect, test, type Page } from '@playwright/test'

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

async function expectHealthyRoute(page: Page, route: string) {
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

test.describe('route smoke coverage', () => {
  for (const route of [...publicRoutes, ...protectedRoutes]) {
    test(`${route} renders or redirects to auth without fatal errors`, async ({ page }) => {
      await expectHealthyRoute(page, route)
    })
  }
})
