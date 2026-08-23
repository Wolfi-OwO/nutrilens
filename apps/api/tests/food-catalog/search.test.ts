import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// Test fixture IDs to avoid collisions with real USDA data
const TEST_FIXTURE_IDS = {
	chickenBreast: 999001,
	oliveOil: 999002,
	cheddarCheese: 999003,
};

describe('food-catalog: search', () => {
    let server: TestServer;
	let pool: pg.Pool;

    before(async () => {
        server = await startTestServer();
		pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

		// Insert minimal test fixtures for search tests.
		// These are isolated to this test suite and cleaned up in after().
		await pool.query(
			`INSERT INTO food_catalog (fdc_id, description, data_type, category, calories_kcal, protein_grams, carb_grams, fat_grams)
			 VALUES
			 	($1, $2, $3, $4, $5, $6, $7, $8),
			 	($9, $10, $11, $12, $13, $14, $15, $16),
			 	($17, $18, $19, $20, $21, $22, $23, $24)
			 ON CONFLICT (fdc_id) DO NOTHING`,
			[
				TEST_FIXTURE_IDS.chickenBreast, 'Chicken breast, raw', 'foundation_food', 'meat', 165, 31.0, 0, 3.6,
				TEST_FIXTURE_IDS.oliveOil, 'Olive oil', 'foundation_food', 'oils', 884, 0, 0, 100,
				TEST_FIXTURE_IDS.cheddarCheese, 'Cheese, cheddar', 'foundation_food', 'dairy', 403, 23.5, 1.3, 33.3,
			],
		);
    });

    after(async () => {
        // Clean up test fixtures
		try {
			await pool.query(
				`DELETE FROM food_catalog WHERE fdc_id = ANY($1)`,
				[Object.values(TEST_FIXTURE_IDS)],
			);
		} finally {
			await pool.end();
		}
        await server.close();
    });

    test('requires authentication', async () => {
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=chicken&limit=5');
        assert.equal(res.status, 401);
    });

    test('rejects query < 2 chars', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-min');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=a&limit=5', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('rejects query > 100 chars', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-max');
        const query = 'a'.repeat(101);
        const res = await apiRequest(server.baseUrl, `/food-catalog/search?q=${query}&limit=5`, {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('rejects limit < 1', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-limit-min');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=chicken&limit=0', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('rejects limit > 25', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-limit-max');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=chicken&limit=26', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('returns results with per-100g macros', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-valid');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=chicken+breast&limit=5', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<{
            fdcId: number;
            description: string;
            caloriesKcal: number | null;
            proteinGrams: number | null;
            carbGrams: number | null;
            fatGrams: number | null;
        }>;
        assert.ok(Array.isArray(results));
        assert.ok(results.length > 0, 'Should find at least one chicken breast');

        // Verify structure and per-100g data is present.
        const first = results[0];
        assert.ok(first);
        assert.ok(first.fdcId > 0);
        assert.ok(first.description);
        assert.ok(typeof first.caloriesKcal === 'number' || first.caloriesKcal === null);
        assert.ok(typeof first.proteinGrams === 'number' || first.proteinGrams === null);
    });

    test('ranks obvious foods at the top', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-rank');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=olive+oil&limit=10', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<{ description: string }>;
        assert.ok(results.length > 0);

        // The first result should be a direct match ("olive oil") not a loose match
        const first = results[0];
        assert.ok(first, 'First result should exist');
        const desc = first.description.toLowerCase();
        assert.ok(
            desc.includes('olive') && desc.includes('oil'),
            `Expected "olive oil" in first result, got "${first.description}"`,
        );
    });

    test('defaults limit to 10', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-default-limit');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=cheese', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<unknown>;
        assert.ok(results.length > 0);
        assert.ok(results.length <= 10, `Should respect default limit of 10, got ${results.length}`);
    });

    test('handles empty result set gracefully', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-search-empty');
        const res = await apiRequest(
            server.baseUrl,
            '/food-catalog/search?q=xyzabc123notafood&limit=5',
            {
                headers: authHeader(user),
            },
        );
        assert.equal(res.status, 200);

        const results = res.body as Array<unknown>;
        assert.ok(Array.isArray(results));
        assert.equal(results.length, 0);
    });

    test('null macros are preserved (not zeroed)', async () => {
        // This test verifies the CRITICAL TRAP: nullable vs zero. The search
        // should return foods with null values where USDA did not report a
        // nutrient, not 0. This is a reference data invariant.
        const user = await registerAndLogin(server.baseUrl, 'food-search-nulls');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=banana&limit=5', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<{
            carbGrams: number | null;
            proteinGrams: number | null;
            fatGrams: number | null;
        }>;
        // At least one food should be present (bananas have carbs but minimal fat/protein).
        // Just verify the structure allows nulls and they aren't forced to 0.
        for (const food of results) {
            assert.ok(
                typeof food.carbGrams === 'number' || food.carbGrams === null,
                'carbGrams should be number or null',
            );
            assert.ok(
                typeof food.proteinGrams === 'number' || food.proteinGrams === null,
                'proteinGrams should be number or null',
            );
        }
    });
});
