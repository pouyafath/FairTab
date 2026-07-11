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

test('creates a group, records an expense, and toggles archive state', async ({ page }) => {
  const suffix = Date.now()
  const groupName = `E2E Trip ${suffix}`

  await page.goto('/groups/new')
  await page.waitForLoadState('networkidle')
  await page.locator('#group-name').fill(groupName)
  const createButton = page.getByRole('button', { name: /Create Group/i })
  await expect(createButton).toBeEnabled()
  await createButton.click()

  await expect(page).toHaveURL(/\/groups\/[^/]+$/)
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()

  await addMember(page, 'Alice')
  await addMember(page, 'Bob')

  const groupUrl = page.url().split('?')[0]
  await page.goto(`${groupUrl}?fresh=${Date.now()}`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: groupName })).toBeVisible()
  await expect(page.getByText('Alice', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Bob', { exact: true }).first()).toBeVisible()

  const addExpenseLink = page.getByRole('link', { name: /Add Expense/i })
  await expect(addExpenseLink).toBeVisible()
  const addExpenseHref = await addExpenseLink.getAttribute('href')
  expect(addExpenseHref).toMatch(/\/groups\/[^/]+\/expenses\/new$/)
  await page.goto(addExpenseHref)
  await expect(page).toHaveURL(/\/expenses\/new$/)
  await page.getByLabel(/What was it for/i).fill('Dinner')
  await page.getByLabel(/Amount/i).fill('42.50')
  await page.getByRole('combobox', { name: 'Paid by' }).click()
  await page.getByRole('option', { name: 'Alice' }).click()
  await page.getByRole('button', { name: /^Add Expense$/i }).click()

  // With file storage enabled (the default in e2e), saving advances to an
  // optional receipt-upload step; finish it to return to the group.
  await expect(page.getByText('Expense saved!')).toBeVisible()
  await page.getByRole('button', { name: /^Done$/i }).click()

  await expect(page.getByText('Dinner').first()).toBeVisible()
  await expect(page.getByText('$42.50').first()).toBeVisible()

  await page.getByRole('button', { name: /Settings/i }).click()
  await page.getByRole('button', { name: /Archive group/i }).click()
  await expect(page.getByText('Archived group')).toBeVisible()

  await page.getByRole('button', { name: /^Unarchive$/i }).click()
  await expect(page.getByText('Archived group')).toBeHidden()
})
