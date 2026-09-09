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
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
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
  // Four cold Vite route compilations can saturate a Windows workstation and
  // create false one-minute timeouts. Keep the full suite parallel, but cap
  // local Windows runs at two workers; CI and other platforms keep defaults.
  workers: !process.env['CI'] && process.platform === 'win32' ? 2 : undefined,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'ar',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
