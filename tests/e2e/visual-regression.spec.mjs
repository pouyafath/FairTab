import { expect, test } from '@playwright/test'

const routes = [
  { path: '/', name: 'homepage' },
  { path: '/groups', name: 'groups' },
  { path: '/personal', name: 'personal' },
  { path: '/settings', name: 'settings' },
]

test.describe('visual regression @visual', () => {
  for (const route of routes) {
    test(`${route.name} renders consistently`, async ({ page }) => {
      await page.goto(route.path)
      await expect(page).toHaveScreenshot(`${route.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      })
    })
  }
})
