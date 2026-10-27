import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  )
  expect(hasOverflow).toBe(false)
}

test('layout exposes landmarks and keyboard skip navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('contentinfo')).toBeVisible()

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: /Skip to content/i })
  await expect(skipLink).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#main-content$/)
})

test('group lookup is keyboard reachable and has clear disabled state', async ({ page }) => {
  await page.goto('/groups')

  const tokenInput = page.getByRole('textbox', { name: 'Group token' })
  const findButton = page.getByRole('button', { name: /^Find$/ })

  await expect(tokenInput).toBeVisible()
  await expect(findButton).toBeDisabled()

  await tokenInput.focus()
  await page.keyboard.type('abc123')
  await expect(findButton).toBeEnabled()
})

test('primary navigation follows a predictable keyboard focus path', async ({ page }) => {
  await page.goto('/')

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /Skip to content/i })).toBeFocused()

  const expectedFocusOrder = [
    page.getByRole('link', { name: 'FairTab home' }),
    page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Groups' }),
    page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Personal' }),
    page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Privacy' }),
  ]

  for (const locator of expectedFocusOrder) {
    await page.keyboard.press('Tab')
    await expect(locator).toBeFocused()
  }
})

test('not-found fallback exposes recovery actions', async ({ page }) => {
  const response = await page.goto('/missing-production-route')

  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go home' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Groups' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('route loading and error boundaries are present for production fallbacks', () => {
  const fallbackFiles = [
    'app/loading.tsx',
    'app/groups/loading.tsx',
    'app/groups/[token]/loading.tsx',
    'app/personal/loading.tsx',
    'app/error.tsx',
    'app/groups/[token]/error.tsx',
    'app/personal/error.tsx',
  ]

  for (const file of fallbackFiles) {
    expect(existsSync(join(process.cwd(), file)), `${file} should exist`).toBe(true)
  }
})

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test.describe(`${viewport.name} layout smoke`, () => {
    test.use({ viewport })

    for (const route of ['/', '/groups', '/personal', '/settings']) {
      test(`${route} fits without horizontal overflow`, async ({ page }) => {
        await page.goto(route)

        await expect(page.getByRole('main')).toBeVisible()
        await expectNoHorizontalOverflow(page)
      })
    }
  })
}
