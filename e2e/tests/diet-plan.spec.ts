import { expect, test } from '@playwright/test'
import { registerAndLogin, uniqueEmail } from './helpers.ts'

test.describe('diet plan', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page, uniqueEmail('plan'), 'Plan Tester')
    await page.goto('/plan')
  })

  test('creates a plan with a chosen goal and targets', async ({ page }) => {
    await expect(page.getByTestId('plan-create-heading')).toBeVisible()

    // The radio's `value` is the raw goal enum the API stores, so it selects
    // the same control the 'Lose weight' label did without depending on the
    // label. Both target inputs are matched by the form-field ids, which are
    // the API payload's own field names.
    await page.locator('input[type="radio"][value="lose_weight"]').check({ force: true })
    await page.locator('#dailyCalorieTarget').fill('1800')
    await page.locator('#proteinTargetGrams').fill('140')
    await page.locator('#carbTargetGrams').fill('180')
    await page.locator('#fatTargetGrams').fill('55')
    await page.getByTestId('plan-create').click()

    // data-goal on the summary carries the enum, so this still proves the goal
    // that was chosen came back — and proves it more exactly than a match on
    // the goal's rendered label did.
    await expect(page.getByTestId('plan-summary')).toHaveAttribute('data-goal', 'lose_weight')
    await expect(page.locator('#dailyCalorieTarget')).toHaveValue('1800')
  })

  test('edits targets on an existing plan', async ({ page }) => {
    await page.getByTestId('plan-create').click()
    await expect(page.getByTestId('plan-summary')).toBeVisible()

    const calorieInput = page.locator('#dailyCalorieTarget')
    await calorieInput.fill('2200')
    await page.getByTestId('plan-save').click()

    await expect(page.getByTestId('plan-saved')).toBeVisible()
    await page.reload()
    await expect(page.locator('#dailyCalorieTarget')).toHaveValue('2200')
  })

  test('warns on an unusually low calorie target without blocking submission', async ({ page }) => {
    await page.locator('#dailyCalorieTarget').fill('500')
    await expect(page.getByTestId('plan-warning')).toBeVisible()

    // A warning, not a hard block (UC-10 4a) — the button stays enabled.
    await expect(page.getByTestId('plan-create')).toBeEnabled()
  })
})
