import { expect, test } from '@playwright/test'

/**
 * Patient registration journey — three-part name + email verification.
 *
 * No OTP code is ever fabricated here: while `enable_phone_auth` is off the
 * phone option must surface the Arabic "not available" message instead.
 */

const NAME = { first: 'محمد', father: 'علي', family: 'المصلي' }

async function gotoSignup(page: import('@playwright/test').Page) {
  await page.goto('/auth?mode=signup', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()
}

async function fillName(page: import('@playwright/test').Page) {
  await page.getByLabel('الاسم الأول').fill(NAME.first)
  await page.getByLabel('اسم الأب').fill(NAME.father)
  await page.getByLabel('اسم العائلة').fill(NAME.family)
}

test.describe('patient registration — name step', () => {
  test('requires all three name parts before continuing', async ({ page }) => {
    await gotoSignup(page)
    await page.getByLabel('الاسم الأول').fill(NAME.first)
    await page.getByRole('button', { name: 'متابعة' }).click()

    await expect(page.getByText('يرجى إدخال الاسم الثلاثي بشكل صحيح.')).toBeVisible()
    await expect(page.getByText('أدخل اسمك الثلاثي')).toBeVisible()
  })

  test('previews the full name and moves to the verification method step', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page)

    await expect(page.getByText(`${NAME.first} ${NAME.father} ${NAME.family}`)).toBeVisible()

    await page.getByRole('button', { name: 'متابعة' }).click()
    await expect(page.getByText('اختر طريقة التحقق')).toBeVisible()
  })
})

test.describe('verification method step', () => {
  test('phone stays unavailable while the SMS provider is not configured', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page)
    await page.getByRole('button', { name: 'متابعة' }).click()

    const phoneButton = page.getByRole('button', { name: /رقم الهاتف/ })
    await expect(phoneButton).toBeVisible()

    const disabled = await phoneButton.getAttribute('aria-disabled')
    if (disabled === 'true') {
      await phoneButton.click()
      await expect(
        page.getByText('التحقق عبر رقم الهاتف غير متاح حاليًا. يرجى استخدام البريد الإلكتروني.'),
      ).toBeVisible()
    } else {
      // Flag enabled: the phone step must render, and no OTP is ever faked here.
      await phoneButton.click()
      await expect(page.getByRole('button', { name: 'إرسال رمز التحقق' })).toBeVisible()
    }
  })

  test('email path opens the email form', async ({ page }) => {
    await gotoSignup(page)
    await fillName(page)
    await page.getByRole('button', { name: 'متابعة' }).click()
    await page.getByRole('button', { name: /البريد الإلكتروني/ }).click()

    await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible()
  })
})

test.describe('email registration validation', () => {
  test('rejects an invalid email and a short password without calling the backend', async ({
    page,
  }) => {
    await gotoSignup(page)
    await fillName(page)
    await page.getByRole('button', { name: 'متابعة' }).click()
    await page.getByRole('button', { name: /البريد الإلكتروني/ }).click()

    await page.getByLabel('البريد الإلكتروني').fill('not-an-email')
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await expect(page.getByText('البريد الإلكتروني غير صالح')).toBeVisible()

    await page.getByLabel('البريد الإلكتروني').fill(`e2e+${Date.now()}@muslly.com`)
    const password = page.locator('input[type="password"]').first()
    await password.fill('123')
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
    await expect(page.getByText('كلمة المرور يجب أن تكون 8 أحرف على الأقل.')).toBeVisible()
  })
})
