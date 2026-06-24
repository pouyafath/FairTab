import { expect, test } from '@playwright/test'

test('adds a personal transaction, filters it, and exports the current view', async ({ page }) => {
  const suffix = Date.now()
  const title = `E2E Coffee ${suffix}`

  await page.goto('/personal/transactions/new')
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/Description/i).fill(title)
  await page.getByLabel(/Amount/i).fill('6.25')
  await page.getByRole('combobox', { name: 'Transaction category' }).click()
  await page.getByRole('option', { name: 'Food & Dining' }).click()
  const addButton = page.getByRole('button', { name: /Add Expense/i })
  await expect(addButton).toBeEnabled()
  await addButton.click()

  await expect(page.getByRole('heading', { name: 'Personal Finance' })).toBeVisible()
  const transactionTitle = page.locator('p', { hasText: title }).first()
  await expect(transactionTitle).toBeVisible()

  await page.getByPlaceholder('Search transactions').fill(title)
  await expect(transactionTitle).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export View/i }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^fairtab-transactions-\d{4}-\d{2}\.csv$/)
})
