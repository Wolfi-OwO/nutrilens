import { expect, test } from '@playwright/test';
import {
    createDefaultPlan,
    mealItemField,
    registerAndLogin,
    seedFoodCatalogFixtures,
    uniqueEmail,
} from './helpers.ts';

test.describe('food catalog autocomplete', () => {
    test.beforeEach(async ({ page }) => {
        // docker compose up alone leaves food_catalog empty (see helpers.ts's
        // seedFoodCatalogFixtures doc comment) — seed the two fixtures this
        // spec depends on before every test, same as promoteToAdmin above.
        await seedFoodCatalogFixtures();
        await registerAndLogin(page, uniqueEmail('autocomplete'), 'Autocomplete Tester');
        await createDefaultPlan(page);
        await page.getByTestId('nav-log-food').click();
        await page.waitForURL('/log-meal');
        await page.getByTestId('manual-entry').click();
    });

    test('autocomplete returns real results from the API for "banana"', async ({ page }) => {
        // Type "banana" in the food name field
        const foodInput = mealItemField(page, 'foodName').first();
        await foodInput.fill('banana');

        // Wait for autocomplete dropdown to appear
        await page.waitForSelector('[role="option"]', { timeout: 2000 });

        // Get the first option
        const option = page.locator('[role="option"]').first();
        const optionText = await option.textContent();

        // Verify it's the right food (should be "Banana, raw" or similar)
        expect(optionText).toContain('Banana');

        // Click the option
        await option.click();

        // Verify calories/protein/carbs/fat auto-filled
        const caloriesValue = await mealItemField(page, 'calories').first().inputValue();
        const proteinValue = await mealItemField(page, 'proteinGrams').first().inputValue();
        const carbsValue = await mealItemField(page, 'carbGrams').first().inputValue();
        const fatValue = await mealItemField(page, 'fatGrams').first().inputValue();

        expect(caloriesValue).not.toBe('');
        expect(proteinValue).not.toBe('');
        expect(carbsValue).not.toBe('');
        expect(fatValue).not.toBe('');

        console.log(`✓ Banana autocomplete: ${caloriesValue} kcal, ${proteinValue}g protein, ${carbsValue}g carbs, ${fatValue}g fat`);
    });

    test('autocomplete resolves spelling variants (omelette → omelet)', async ({ page }) => {
        // Type "omelette" (British spelling) which should match "Omelet" in the database via word_similarity
        const foodInput = mealItemField(page, 'foodName').first();
        await foodInput.fill('omelette');

        // Wait for autocomplete dropdown
        await page.waitForSelector('[role="option"]', { timeout: 2000 });

        // Get the first option
        const option = page.locator('[role="option"]').first();
        const optionText = await option.textContent();

        // Verify it found an omelet entry (not empty)
        expect(optionText).toBeTruthy();
        expect(optionText?.toLowerCase()).toContain('omelet');

        // Click and verify auto-fill
        await option.click();

        const caloriesValue = await mealItemField(page, 'calories').first().inputValue();
        expect(caloriesValue).not.toBe('');

        console.log(`✓ Omelette (spelling variant) autocomplete: ${caloriesValue} kcal`);
    });

    test('portion scaling re-calculates macros correctly', async ({ page }) => {
        // Set up: log a food and verify initial macros
        const foodInput = mealItemField(page, 'foodName').first();
        await foodInput.fill('banana');

        await page.waitForSelector('[role="option"]', { timeout: 2000 });
        await page.locator('[role="option"]').first().click();

        // Get initial values (100g default)
        const _portion1 = await mealItemField(page, 'portionGrams').first().inputValue();
        const calories1 = await mealItemField(page, 'calories').first().inputValue();

        // Change portion to 200g
        await mealItemField(page, 'portionGrams').first().fill('200');
        await page.keyboard.press('Tab'); // Trigger the change event

        // Wait a moment for re-calculation
        await page.waitForTimeout(500);

        // Get new calorie value
        const calories2 = await mealItemField(page, 'calories').first().inputValue();

        // Verify calories approximately doubled (allowing for rounding)
        const cal1 = parseFloat(calories1);
        const cal2 = parseFloat(calories2);
        const ratio = cal2 / cal1;

        // Should be close to 2x (allow 1.8-2.2 range for rounding)
        expect(ratio).toBeGreaterThan(1.8);
        expect(ratio).toBeLessThan(2.2);

        console.log(`✓ Portion scaling: ${calories1} kcal (100g) → ${calories2} kcal (200g), ratio: ${ratio.toFixed(2)}`);
    });
});
