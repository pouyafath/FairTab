import { expect, test } from '@playwright/test'

async function addMember(page, name) {
  await page.waitForLoadState('networkidle')
  const addMemberButton = page.getByRole('button', { name: /Add Member/i }).first()
  await expect(addMemberButton).toBeEnabled()
  await addMemberButton.click()
  const dialog = page.getByRole('dialog', { name: /Add Member/i })
  await expect(dialog).toBeVisible()
  await dialog.locator('#member-name').fill(name)
  const submitButton = dialog.getByRole('button', { name: /^Add Member$/i })
  await expect(submitButton).toBeEnabled()
  await submitButton.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}

test('settling a debt clears the suggestion, and undo restores it', async ({ page }) => {
  const groupName = `Settle Trip ${Date.now()}`

  await page.goto('/groups/new')
  await page.waitForLoadState('networkidle')
  await page.locator('#group-name').fill(groupName)
  await page.getByRole('button', { name: /Create Group/i }).click()
  await expect(page).toHaveURL(/\/groups\/[^/]+$/)

  await addMember(page, 'Alice')
  await addMember(page, 'Bob')

  const groupUrl = page.url().split('?')[0]

  // Alice pays $42.50, split equally → Bob owes Alice $21.25.
  await page.goto(`${groupUrl}/expenses/new`, { waitUntil: 'networkidle' })
  await page.getByLabel(/What was it for/i).fill('Dinner')
  await page.getByLabel(/Amount/i).fill('42.50')
  await page.getByRole('combobox', { name: 'Paid by' }).click()
  await page.getByRole('option', { name: 'Alice' }).click()
  await page.getByRole('button', { name: /^Add Expense$/i }).click()
  await expect(page.getByText('Expense saved!')).toBeVisible()
  await page.getByRole('button', { name: /^Done$/i }).click()

  // Settle Up shows the suggested transfer.
  await page.goto(`${groupUrl}/settlements`, { waitUntil: 'networkidle' })
  const suggestion = page.getByText(/Bob\s*pays\s*Alice/i).first()
  await expect(suggestion).toBeVisible()
  await expect(page.getByText('$21.25').first()).toBeVisible()

  // Marking it paid nets the balance to zero — the suggestion is gone and the
  // payment appears in history.
  await page.getByRole('button', { name: /^Mark Paid$/i }).click()
  await expect(page.getByRole('heading', { name: /All settled up/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Payment history/i })).toBeVisible()
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible()

  // Undo brings the outstanding debt back.
  await page.getByRole('button', { name: /^Undo$/i }).click()
  await expect(page.getByText(/Bob\s*pays\s*Alice/i).first()).toBeVisible()
  await expect(page.getByText('$21.25').first()).toBeVisible()
})
