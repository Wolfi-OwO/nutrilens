import { expect, test } from '@playwright/test'
import { registerAndLogin, uniqueEmail } from './helpers.ts'

test.describe('progress', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('progress'), 'Progress Tester')
    await page.goto('/progress')
  })

  test('shows empty states before any data exists', async ({ page }) => {
    await expect(page.getByText(/no meals logged yet/i)).toBeVisible()
    await expect(page.getByText(/no weigh-ins yet/i)).toBeVisible()
  })

  test('logs a weight entry and it replaces the empty state', async ({ page }) => {
    await page.getByLabel(/weight/i).fill('72.5')
    await page.getByRole('button', { name: 'Log weight' }).click()

    await expect(page.getByText('72.5 kg')).toBeVisible()
    await expect(page.getByText(/no weigh-ins yet/i)).not.toBeVisible()
  })

  test('overwrites a same-day weight entry with the new value', async ({ page }) => {
    await page.getByLabel(/weight/i).fill('72.5')
    await page.getByRole('button', { name: 'Log weight' }).click()
    await expect(page.getByText('72.5 kg')).toBeVisible()

    await page.getByLabel(/weight/i).fill('73.2')
    await page.getByRole('button', { name: 'Log weight' }).click()

    await expect(page.getByText('73.2 kg')).toBeVisible()
    await expect(page.getByText('72.5 kg')).not.toBeVisible()
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('rejects a non-positive weight client-side', async ({ page }) => {
    await page.getByLabel(/weight/i).fill('0')
    await page.getByRole('button', { name: 'Log weight' }).click()

    await expect(page.getByText(/greater than 0/i)).toBeVisible()
  })
})
