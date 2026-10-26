import { expect, test } from '@playwright/test'
import { PUBLIC_BACKEND } from '../config/public-backend'

test('selected backend hydrates and opens the actual assistant', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const response = await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true')
  expect(response?.headers()['content-security-policy-report-only']).toContain(PUBLIC_BACKEND.url)
  expect(await page.locator('#muslly-public-backend').evaluate((element) => JSON.parse(element.textContent ?? '{}').url)).toBe(PUBLIC_BACKEND.url)
  await page.getByRole('button', { name: 'افتح المساعد الصحي الذكي' }).click()
  await expect(page.getByPlaceholder('اكتب سؤالك أو استخدم الميكروفون…')).toBeVisible()
  expect(errors).toEqual([])
})

test('public catalog opens the selected product', async ({ page }) => {
  await page.goto('/shop?page=1')
  const product = page.getByRole('link', { name: /منتج اختبار اصطناعي/ }).first()
  await expect(product).toBeVisible()
  await product.click()
  await expect(page.getByRole('heading', { name: 'منتج اختبار اصطناعي', exact: true })).toBeVisible()
})

test('health confirms the public backend and worker serves a static offline page', async ({ page, context, request }) => {
  const response = await request.get('/api/public/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ready' })
  await page.goto('/')
  // An active registration can precede clients.claim(); wait until this page is controlled.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  await context.setOffline(true)
  await page.goto('/offline-connection-check', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'أنت غير متصل بالإنترنت' })).toBeVisible()
})

test.describe('initial public content', () => {
  test.use({ javaScriptEnabled: false })
  test('hero and purchase link remain visible before JavaScript', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'صيدلية المصلي — دواؤك يصلك بثقة', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'تسوّق الآن', exact: true })).toBeVisible()
  })
})
