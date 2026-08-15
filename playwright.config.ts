import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8080'

/**
 * Some environments ship a preinstalled Chromium instead of the browser build
 * Playwright downloads. Reuse it when present so `playwright test` runs without
 * a separate `playwright install` step.
 */
const CHROMIUM_PATHS = [
  process.env['PLAYWRIGHT_CHROMIUM_PATH'],
  '/opt/ms-playwright/chromium-1194/chrome-linux/chrome',
  '/bin/chromium',
].filter((p): p is string => Boolean(p))
const executablePath = CHROMIUM_PATHS.find((p) => existsSync(p))


/**
 * E2E specs live in `e2e/` and use the `.e2e.ts` suffix so vitest (which owns
 * `tests/**.test.ts`) never picks them up.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'ar',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
