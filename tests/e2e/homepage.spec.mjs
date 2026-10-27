import { expect, test } from '@playwright/test'

test('homepage presents the product and primary workflows', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'FairTab' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Create a Group/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Personal Dashboard/i })).toBeVisible()

  const createGroupLink = page.getByRole('link', { name: /Create a Group/i })
  await expect(createGroupLink).toBeEnabled()
  await createGroupLink.click()
  await expect(page).toHaveURL(/\/groups\/new$/)
})
