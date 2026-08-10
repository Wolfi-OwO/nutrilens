import { expect, test } from '@playwright/test'
import { registerAndLogin, uniqueEmail } from './helpers.ts'

test.describe('diet plan', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('plan'), 'Plan Tester')
    await page.goto('/plan')
  })

  test('creates a plan with a chosen goal and targets', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Set up your diet plan' })).toBeVisible()

    await page.getByRole('radio', { name: 'Lose weight' }).check({ force: true })
    await page.getByLabel('Daily calories').fill('1800')
    await page.getByLabel('Protein (g)').fill('140')
    await page.getByLabel('Carbs (g)').fill('180')
    await page.getByLabel('Fat (g)').fill('55')
    await page.getByRole('button', { name: 'Create plan' }).click()

    await expect(page.getByText('Lose weight')).toBeVisible()
    await expect(page.getByLabel('Daily calories')).toHaveValue('1800')
  })

  test('edits targets on an existing plan', async ({ page }) => {
    await page.getByRole('button', { name: 'Create plan' }).click()
    await expect(page.getByText('active since')).toBeVisible()

    const calorieInput = page.getByLabel('Daily calories')
    await calorieInput.fill('2200')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Saved.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Daily calories')).toHaveValue('2200')
  })

  test('warns on an unusually low calorie target without blocking submission', async ({ page }) => {
    await page.getByLabel('Daily calories').fill('500')
    await expect(page.getByText(/usually between/i)).toBeVisible()

    // A warning, not a hard block (UC-10 4a) — the button stays enabled.
    await expect(page.getByRole('button', { name: 'Create plan' })).toBeEnabled()
  })
})
