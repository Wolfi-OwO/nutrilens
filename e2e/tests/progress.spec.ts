import { expect, test } from '@playwright/test'
import { registerAndLogin, uniqueEmail } from './helpers.ts'

test.describe('progress', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('progress'), 'Progress Tester')
    await page.goto('/progress')
  })

  test('shows empty states before any data exists', async ({ page }) => {
    await expect(page.getByTestId('progress-meals-empty')).toBeVisible()
    await expect(page.getByTestId('progress-weight-empty')).toBeVisible()
  })

  test('logs a weight entry and it replaces the empty state', async ({ page }) => {
    await page.locator('#weightKg').fill('72.5')
    await page.getByTestId('log-weight-submit').click()

    // "72.5 kg" is the value this test entered plus an SI unit, not copy —
    // translating the page does not change it, so it stays a text match.
    await expect(page.getByText('72.5 kg')).toBeVisible()
    await expect(page.getByTestId('progress-weight-empty')).toHaveCount(0)
  })

  test('overwrites a same-day weight entry with the new value', async ({ page }) => {
    await page.locator('#weightKg').fill('72.5')
    await page.getByTestId('log-weight-submit').click()
    await expect(page.getByText('72.5 kg')).toBeVisible()

    await page.locator('#weightKg').fill('73.2')
    await page.getByTestId('log-weight-submit').click()

    await expect(page.getByText('73.2 kg')).toBeVisible()
    await expect(page.getByText('72.5 kg')).not.toBeVisible()
    // The form's error line is #weightKg-error and is only rendered when there
    // is an error at all — a stricter check than the old match on "something
    // went wrong", which would have passed on any *other* error message.
    await expect(page.locator('#weightKg-error')).toHaveCount(0)
  })

  test('rejects a non-positive weight client-side', async ({ page }) => {
    await page.locator('#weightKg').fill('0')
    await page.getByTestId('log-weight-submit').click()

    // Two facts stand in for the old match on "greater than 0", because one
    // alone would be weaker: the inline error is showing, AND the field still
    // holds the rejected value. The form clears the input on a successful
    // submit, so an unchanged '0' is what makes this specifically a
    // client-side rejection rather than any error at all.
    await expect(page.locator('#weightKg-error')).toBeVisible()
    await expect(page.locator('#weightKg')).toHaveValue('0')
  })
})
