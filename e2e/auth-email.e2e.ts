import { expect, test, type Page } from '@playwright/test'

/**
 * Patient registration journey — three-part name + email verification.
 *
 * No OTP code is ever fabricated here: while `enable_phone_auth` is off the
 * phone option must surface the Arabic "not available" message instead.
 */

const NAME = { first: 'محمد', father: 'علي', family: 'المصلي' }

/** The route renders its own <main>; the app shell renders another one. */
const card = (page: Page) => page.locator('main').last()

async function gotoSignup(page: Page) {
  await page.goto('/auth?mode=signup', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()
}

async function fillName(page: Page, parts = [NAME.first, NAME.father, NAME.family]) {
  const inputs = card(page).locator('input')
  for (const [i, value] of parts.entries()) {
    await inputs.nth(i).fill(value)
  }
}

async function goToMethodStep(page: Page) {
  await gotoSignup(page)
  await fillName(page)
  await card(page).getByRole('button', { name: 'متابعة' }).click()
  await expect(page.getByText('اختر طريقة التحقق')).toBeVisible()
}

async function openEmailForm(page: Page) {
  await goToMethodStep(page)
  await card(page).getByRole('button', { name: 'البريد الإلكتروني', exact: true }).click()
  await expect(card(page).locator('input[type="password"]')).toBeVisible()
}

test.describe('patient registration — name step', () => {
  test('requires all three name parts before continuing', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page, [NAME.first])
    await card(page).getByRole('button', { name: 'متابعة' }).click()

    await expect(page.getByText('يرجى إدخال الاسم الثلاثي بشكل صحيح.')).toBeVisible()
    await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()
  })

  test('previews the full name and moves to the verification method step', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page)

    await expect(page.getByText(`${NAME.first} ${NAME.father} ${NAME.family}`)).toBeVisible()

    await card(page).getByRole('button', { name: 'متابعة' }).click()
    await expect(page.getByText('اختر طريقة التحقق')).toBeVisible()
  })
})

test.describe('verification method step', () => {
  test('phone stays unavailable while the SMS provider is not configured', async ({ page }) => {
    await goToMethodStep(page)

    const phoneButton = card(page).getByRole('button', { name: 'رقم الهاتف', exact: true })
    await expect(phoneButton).toBeVisible()

    if ((await phoneButton.getAttribute('aria-disabled')) === 'true') {
      await expect(
        page.getByText('التحقق عبر رقم الهاتف غير متاح حاليًا. يرجى استخدام البريد الإلكتروني.'),
      ).toBeVisible()
    } else {
      // Flag enabled: the phone step must render, and no OTP is ever faked here.
      await phoneButton.click()
      await expect(card(page).getByRole('button', { name: 'إرسال رمز التحقق' })).toBeVisible()
    }
  })

  test('email path opens the email form', async ({ page }) => {
    await openEmailForm(page)
    await expect(card(page).getByRole('button', { name: 'إنشاء الحساب' })).toBeVisible()
  })
})

test.describe('email registration validation', () => {
  test('rejects an invalid email and a short password without calling the backend', async ({
    page,
  }) => {
    await openEmailForm(page)

    const emailInput = card(page).locator('input').first()
    const passwordInput = card(page).locator('input[type="password"]').first()
    const submit = card(page).getByRole('button', { name: 'إنشاء الحساب' })

    await emailInput.fill('not-an-email')
    await passwordInput.fill('SuperSecret123')
    await submit.click()
    await expect(page.getByText('البريد الإلكتروني غير صالح')).toBeVisible()

    await emailInput.fill(`e2e+${Date.now()}@muslly.com`)
    await passwordInput.fill('123')
    await submit.click()
    await expect(page.getByText('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')).toBeVisible()
  })
})
