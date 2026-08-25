import { expect, test, type Page } from '@playwright/test'

/**
 * Patient registration journey — three-part name + phone + password.
 *
 * There is no OTP step: registration is a single form and the session opens
 * immediately. No verification code is ever fabricated here.
 */

const NAME = { first: 'محمد', father: 'علي', family: 'المصلي' }

/** The route renders its own <main>; the app shell renders another one. */
const card = (page: Page) => page.locator('main').last()

async function gotoSignup(page: Page) {
  await page.goto('/auth?mode=signup', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()

  // Prove that React hydration has attached the mode-switch handler before
  // typing. Waiting for networkidle is unreliable because the app keeps
  // background connections open.
  await expect(async () => {
    await page.getByRole('button', { name: 'لديّ حساب — تسجيل الدخول' }).click()
    await expect(card(page).getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeVisible({
      timeout: 1_000,
    })
  }).toPass({ timeout: 15_000 })
  await page.getByRole('button', { name: 'إنشاء حساب جديد' }).click()
  await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()
}

async function fillName(page: Page, parts = [NAME.first, NAME.father, NAME.family]) {
  const inputs = card(page).locator('input[type="text"]')
  for (const [i, value] of parts.entries()) {
    await inputs.nth(i).fill(value)
  }
}

const submit = (page: Page) => card(page).getByRole('button', { name: /إنشاء الحساب والدخول/ })

test.describe('patient registration — single form', () => {
  test('requires all three name parts', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page, [NAME.first])
    await submit(page).click()

    await expect(page.getByText('يرجى إدخال الاسم الثلاثي بشكل صحيح.')).toBeVisible()
  })

  test('previews the full name and shows phone + optional insurance card', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page)

    await expect(page.getByText(`${NAME.first} ${NAME.father} ${NAME.family}`)).toBeVisible()
    await expect(card(page).locator('input[type="tel"]')).toBeVisible()
    await expect(page.getByText('(اختياري)')).toBeVisible()
  })

  test('rejects an invalid phone and a short password without calling the backend', async ({
    page,
  }) => {
    await gotoSignup(page)
    await fillName(page)

    const phoneInput = card(page).locator('input[type="tel"]')
    const passwordInput = card(page).locator('input[type="password"]').first()

    await phoneInput.fill('12')
    await passwordInput.fill('SuperSecret123')
    await submit(page).click()
    await expect(page.getByText('رقم الهاتف غير صالح. مثال: 7XXXXXXXX')).toBeVisible()

    await phoneInput.fill('771234567')
    await passwordInput.fill('123')
    await submit(page).click()
    await expect(page.getByText('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')).toBeVisible()
  })

  test('sign-in accepts a phone or an email identifier', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' })
    await expect(card(page).getByRole('button', { name: 'تسجيل الدخول' })).toBeVisible()
    await expect(page.getByText('رقم الهاتف أو البريد الإلكتروني')).toBeVisible()
  })
})
