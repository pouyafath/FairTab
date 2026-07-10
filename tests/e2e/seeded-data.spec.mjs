import { expect, test } from '@playwright/test'

test('seeded group data is readable and added to recent groups', async ({ page }) => {
  await page.goto('/groups/seedtrip')

  await expect(page.getByRole('heading', { name: 'E2E Seed Trip' })).toBeVisible()
  await expect(page.getByText('Seed Alice', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Seed Bob', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Seed dinner').first()).toBeVisible()
  await expect(page.getByText('$64.00').first()).toBeVisible()

  // Visiting a group records it in localStorage via a post-hydration effect.
  // Wait for that write before navigating, otherwise the SSR "No recent groups"
  // empty state can still be on /groups when we assert.
  await page.waitForFunction(() => {
    try {
      return JSON.parse(localStorage.getItem('fairtab_recent_groups') || '[]').length > 0
    } catch {
      return false
    }
  })

  await page.goto('/groups')
  await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible()
  await expect(page.getByText('E2E Seed Trip').first()).toBeVisible()
})

test('seeded personal transaction is searchable and exportable', async ({ page }) => {
  await page.goto('/personal')

  await expect(page.getByRole('heading', { name: 'Personal Finance' })).toBeVisible()
  await expect(page.locator('p', { hasText: 'Seed groceries' }).first()).toBeVisible()
  await expect(page.getByText('$23.89').first()).toBeVisible()

  await page.getByPlaceholder('Search transactions').fill('Seed groceries')
  await expect(page.locator('p', { hasText: 'Seed groceries' }).first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export View/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^fairtab-transactions-\d{4}-\d{2}\.csv$/)
})

test('health endpoint exposes app and migration metadata', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)

  const payload = await response.json()
  expect(payload.status).toBe('ok')
  expect(payload.database.status).toBe('ok')
  expect(payload.app.name).toBe('fairtab')
  expect(payload.app.version).toMatch(/^\d+\.\d+\.\d+/)
  expect(payload.runtime.storageAdapter).toMatch(/^(sqlite|cloudflare-d1)$/)
  expect(typeof payload.runtime.backupAuthConfigured).toBe('boolean')
  expect(payload.migrations.status).toBe('tracked')
  expect(payload.migrations.latest).toBe('0008_recurring_rules_due_index.sql')
  expect(payload.migrations.expectedLatest).toBe('0008_recurring_rules_due_index.sql')
  expect(payload.migrations.drift).toBe(false)
})

test('full backup export can be dry-run validated', async ({ request }) => {
  const exportResponse = await request.get('/api/backups/export', {
    headers: { Authorization: 'Bearer e2e-fairtab-backup-token' },
  })
  expect(exportResponse.ok()).toBe(true)
  expect(exportResponse.headers()['content-disposition']).toContain('fairtab-backup-')

  const backup = await exportResponse.json()
  expect(backup.format).toBe('fairtab.backup')
  expect(backup.version).toBe(1)
  expect(backup.rowCounts.groups).toBeGreaterThanOrEqual(1)
  expect(backup.rowCounts.groupMembers).toBeGreaterThanOrEqual(2)
  expect(backup.rowCounts.expenses).toBeGreaterThanOrEqual(1)
  expect(backup.rowCounts.expenseParticipants).toBeGreaterThanOrEqual(2)
  expect(backup.rowCounts.personalTransactions).toBeGreaterThanOrEqual(1)

  const validateResponse = await request.post('/api/backups/validate', {
    data: backup,
    headers: { Authorization: 'Bearer e2e-fairtab-backup-token' },
  })
  expect(validateResponse.ok()).toBe(true)

  const validation = await validateResponse.json()
  expect(validation.valid).toBe(true)
  expect(validation.canRestore).toBe(false)
  expect(validation.currentSummary.groups).toBeGreaterThanOrEqual(1)
  expect(validation.currentSummary.groupMembers).toBeGreaterThanOrEqual(2)
  expect(validation.conflicts.length).toBeGreaterThan(0)
})

test('backup restore execution is protected by backup authorization', async ({ request }) => {
  const response = await request.post('/api/backups/restore', {
    data: { backup: {}, mode: 'empty' },
  })

  expect([401, 403]).toContain(response.status())
  const payload = await response.json()
  expect(payload.error).toMatch(/Backup token/)
})
