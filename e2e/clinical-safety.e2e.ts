import { expect, test, type Page } from '@playwright/test'

async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true')
}

test('unavailable or unrecognized clinical knowledge never produces a clean interaction result', async ({ page }) => {
  await gotoReady(page, '/tools/interactions')
  const input = page.getByRole('textbox', { name: 'اسم المادة الفعالة' })
  const add = page.getByRole('button', { name: 'إضافة', exact: true })
  for (const ingredient of ['synthetic-unknown-a', 'synthetic-unknown-b']) {
    await input.fill(ingredient)
    await expect(add).toBeEnabled()
    await add.click()
    await expect(input).toHaveValue('')
  }
  await page.getByRole('button', { name: 'فحص التداخلات', exact: true }).click()
  await expect(page.getByText('تعذّر التحقق من التداخلات أو التعرف على جميع المواد. لا تعتبر ذلك تأكيدًا للأمان؛ راجع الصيدلي.')).toBeVisible()
  await expect(page.getByText('لا توجد تداخلات موثّقة لدينا')).toHaveCount(0)
})

test('pediatric calculator requires valid age and weight before continuing', async ({ page }) => {
  await gotoReady(page, '/tools/pediatric-dose')
  const next = page.getByRole('button', { name: 'التالي', exact: true })
  await next.click()
  const weight = page.getByPlaceholder('مثال: 14.5')
  const age = page.getByPlaceholder('مثال: 30')
  await expect(weight).toBeVisible()
  await weight.fill('10')
  await expect(next).toBeDisabled()
  await age.fill('1')
  await expect(next).toBeDisabled()
  await age.fill('12')
  await weight.fill('0')
  await expect(next).toBeDisabled()
  await weight.fill('10')
  await expect(next).toBeEnabled()
})
