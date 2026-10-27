import { defineConfig, devices } from '@playwright/test'

const port = process.env.PORT ?? '3000'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`
const databaseUrl = process.env.DATABASE_URL ?? './.tmp/fairtab-e2e.db'
// Export is hard-gated; the dev server this spawns needs a token, and
// seeded-data.spec.mjs sends this same literal as its bearer header.
const backupToken = process.env.FAIRTAB_BACKUP_TOKEN ?? 'e2e-fairtab-backup-token'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `DATABASE_URL="${databaseUrl}" node scripts/prepare-e2e-db.js && DATABASE_URL="${databaseUrl}" FAIRTAB_BACKUP_TOKEN="${backupToken}" node node_modules/next/dist/bin/next dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
