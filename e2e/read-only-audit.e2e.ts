import { test, expect } from '@playwright/test'

/**
 * Opt-in, read-only HTTP/browser audit. Run only against an authorized target.
 * No clicks, form submissions, authentication attempts, DB writes or screenshots
 * of private pages. Intentionally avoids logging credentials or response bodies.
 */
test.describe('read-only public entry audit', () => {
  test('public entry responds and does not produce browser page errors', async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.name))
    const response = await request.get('/', { maxRedirects: 5 })
    expect(response.status(), 'public route should respond, not 5xx').toBeLessThan(500)
    const pageResponse = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(pageResponse, 'navigation should return HTTP response').not.toBeNull()
    await expect(page.locator('body')).toBeVisible()
    expect(errors, 'browser exceptions (error names only)').toEqual([])
  })

  test('headers are inspectable without disclosing header values', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()
    const present = ['content-security-policy', 'x-content-type-options', 'referrer-policy']
      .filter((key) => Object.hasOwn(headers, key))
    test.info().annotations.push({ type: 'security-headers-present', description: present.join(', ') || 'none' })
    expect(response.status()).toBeLessThan(500)
  })
})
