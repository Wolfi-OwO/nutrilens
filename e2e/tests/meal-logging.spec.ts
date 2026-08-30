import { expect, test } from '@playwright/test';
import { createDefaultPlan, mealItemField, registerAndLogin, uniqueEmail } from './helpers.ts';

test.describe('meal logging', () => {
    test.beforeEach(async ({ page }) => {
        await registerAndLogin(page, uniqueEmail('meal'), 'Meal Tester');
    });

    test('logs a meal manually and it shows up on the dashboard', async ({ page }) => {
        await createDefaultPlan(page);
        await page.getByTestId('nav-log-food').click();
        await page.waitForURL('/log-meal');

        await page.getByTestId('manual-entry').click();

        await mealItemField(page, 'foodName').fill('Test Meal E2E');
        await mealItemField(page, 'portionGrams').fill('200');
        await mealItemField(page, 'calories').fill('450');
        await mealItemField(page, 'proteinGrams').fill('30');
        await mealItemField(page, 'carbGrams').fill('40');
        await mealItemField(page, 'fatGrams').fill('15');

        await page.getByTestId('confirm-log').click();

        await page.waitForURL('/');
        await expect(page.getByText('Test Meal E2E')).toBeVisible();
        // The new dashboard shows the kcal twice — as the section subtotal and
        // again in the meal row — so scope the assertion to the meal's list item.
        //
        // `.filter({ hasText })`, not `getByRole('listitem', { hasText })`:
        // getByRole has no hasText option (tsc: "'hasText' does not exist in
        // type ..."), Playwright ignores the unknown key, and the locator was
        // in fact every listitem on the page. It passed only because exactly
        // one of them happened to contain "450 kcal" — the scoping the comment
        // above describes was not happening.
        //
        // Both texts stay text matches: the meal name is what this test typed
        // in and "450 kcal" is that number plus a unit symbol. Neither is copy.
        await expect(
            page.getByRole('listitem').filter({ hasText: 'Test Meal E2E' }).getByText('450 kcal'),
        ).toBeVisible();
    });

    test('blocks meal logging with no active plan and points at Plan setup', async ({ page }) => {
        // A fresh account has no diet plan yet — POST /meal-logs should 409,
        // and the UI should surface that with a way forward, not a dead end.
        await page.getByTestId('nav-log-food').click();
        await page.waitForURL('/log-meal');
        await page.getByTestId('manual-entry').click();

        await mealItemField(page, 'foodName').fill('Blocked Meal');
        await mealItemField(page, 'portionGrams').fill('100');
        await mealItemField(page, 'calories').fill('100');
        await page.getByTestId('confirm-log').click();

        // The no-plan branch is the only one that renders a link to /plan
        // inside the submit error, so "the alert offers a route to plan setup"
        // identifies that specific error without matching its wording — the
        // /plan href is not copy, and it is what "points at Plan setup" in the
        // test name actually means.
        const alert = page.getByRole('alert');
        await expect(alert).toBeVisible();
        await expect(alert.locator('a[href="/plan"]')).toBeVisible();
    });

    test('add another item allows logging a multi-item meal', async ({ page }) => {
        await page.getByTestId('nav-log-food').click();
        await page.waitForURL('/log-meal');
        await page.getByTestId('manual-entry').click();

        await mealItemField(page, 'foodName').fill('Item One');
        await mealItemField(page, 'portionGrams').first().fill('100');
        await mealItemField(page, 'calories').first().fill('200');

        await page.getByTestId('add-item').click();
        const foodInputs = mealItemField(page, 'foodName');
        await expect(foodInputs).toHaveCount(2);
        await foodInputs.nth(1).fill('Item Two');
        await mealItemField(page, 'portionGrams').nth(1).fill('150');
        await mealItemField(page, 'calories').nth(1).fill('150');

        await page.getByTestId('confirm-log').click();
        // Same 409 as above (no plan yet) — this test only verifies the
        // multi-item form itself works, not the submit outcome.
        await expect(page.getByRole('alert')).toBeVisible();
    });
});
