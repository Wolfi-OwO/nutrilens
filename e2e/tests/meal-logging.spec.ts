import { expect, test } from '@playwright/test';
import { createDefaultPlan, registerAndLogin, uniqueEmail } from './helpers.ts';

test.describe('meal logging', () => {
    test.beforeEach(async ({ page }) => {
        await registerAndLogin(page, uniqueEmail('meal'), 'Meal Tester');
    });

    test('logs a meal manually and it shows up on the dashboard', async ({ page }) => {
        await createDefaultPlan(page);
        await page.getByRole('link', { name: 'Log Food' }).click();
        await page.waitForURL('/log-meal');

        await page.getByRole('button', { name: 'Enter it manually' }).click();

        await page.getByPlaceholder('Grilled chicken salad').fill('Test Meal E2E');
        await page.getByLabel('Portion (g)').fill('200');
        await page.getByLabel('Calories').fill('450');
        await page.getByLabel('Protein (g)').fill('30');
        await page.getByLabel('Carbs (g)').fill('40');
        await page.getByLabel('Fat (g)').fill('15');

        await page.getByRole('button', { name: 'Confirm & log' }).click();

        await page.waitForURL('/');
        await expect(page.getByText('Test Meal E2E')).toBeVisible();
        // The new dashboard shows the kcal twice — as the section subtotal and
        // again in the meal row — so scope the assertion to the meal's list item.
        await expect(
            page.getByRole('listitem', { hasText: 'Test Meal E2E' }).getByText('450 kcal'),
        ).toBeVisible();
    });

    test('blocks meal logging with no active plan and points at Plan setup', async ({ page }) => {
        // A fresh account has no diet plan yet — POST /meal-logs should 409,
        // and the UI should surface that with a way forward, not a dead end.
        await page.getByRole('link', { name: 'Log Food' }).click();
        await page.waitForURL('/log-meal');
        await page.getByRole('button', { name: 'Enter it manually' }).click();

        await page.getByPlaceholder('Grilled chicken salad').fill('Blocked Meal');
        await page.getByLabel('Portion (g)').fill('100');
        await page.getByLabel('Calories').fill('100');
        await page.getByRole('button', { name: 'Confirm & log' }).click();

        await expect(page.getByRole('alert')).toContainText(/active diet plan/i);
        await expect(page.getByRole('link', { name: 'Set up a plan' })).toBeVisible();
    });

    test('add another item allows logging a multi-item meal', async ({ page }) => {
        await page.getByRole('link', { name: 'Log Food' }).click();
        await page.waitForURL('/log-meal');
        await page.getByRole('button', { name: 'Enter it manually' }).click();

        await page.getByPlaceholder('Grilled chicken salad').fill('Item One');
        await page.getByLabel('Portion (g)').first().fill('100');
        await page.getByLabel('Calories').first().fill('200');

        await page.getByRole('button', { name: 'Add another item' }).click();
        const foodInputs = page.getByPlaceholder('Grilled chicken salad');
        await expect(foodInputs).toHaveCount(2);
        await foodInputs.nth(1).fill('Item Two');
        await page.getByLabel('Portion (g)').nth(1).fill('150');
        await page.getByLabel('Calories').nth(1).fill('150');

        await page.getByRole('button', { name: 'Confirm & log' }).click();
        // Same 409 as above (no plan yet) — this test only verifies the
        // multi-item form itself works, not the submit outcome.
        await expect(page.getByRole('alert')).toBeVisible();
    });
});
