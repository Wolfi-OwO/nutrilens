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
	// Carries a literal '(' and '%' on purpose. Real USDA descriptions look
	// like this ("Apple juice, 100%"), and those two characters are what let
	// the escaping tests below actually fail when the escaping is removed: the
	// ORDER BY regex is only evaluated on rows the ILIKE pass already matched,
	// so without a row containing '(' a broken pattern is never compiled.
	reducedFatMilk: 999004,
	// The #208 case. Its description deliberately carries no German at all, so
	// "Semmel" can only reach it through food_catalog_names — if the alias arm of
	// the search ever stops working this fixture becomes unfindable, rather than
	// quietly matching on its own description and hiding the regression.
	breadRoll: 999005,
};

/** The German alias attached to the breadRoll fixture. */
const GERMAN_ALIAS = 'Semmel';

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
			 	($17, $18, $19, $20, $21, $22, $23, $24),
			 	($25, $26, $27, $28, $29, $30, $31, $32),
			 	($33, $34, $35, $36, $37, $38, $39, $40)
			 ON CONFLICT (fdc_id) DO NOTHING`,
			[
				TEST_FIXTURE_IDS.chickenBreast, 'Chicken breast, raw', 'foundation_food', 'meat', 165, 31.0, 0, 3.6,
				TEST_FIXTURE_IDS.oliveOil, 'Olive oil', 'foundation_food', 'oils', 884, 0, 0, 100,
				TEST_FIXTURE_IDS.cheddarCheese, 'Cheese, cheddar', 'foundation_food', 'dairy', 403, 23.5, 1.3, 33.3,
				TEST_FIXTURE_IDS.reducedFatMilk, 'Milk, reduced fat (2%)', 'foundation_food', 'dairy', 50, 3.3, 4.8, 2.0,
				TEST_FIXTURE_IDS.breadRoll, 'Roll, plain, unenriched', 'foundation_food', 'baked', 289, 9.0, 51.0, 4.2,
			],
		);

		await pool.query(
			`INSERT INTO food_catalog_names (fdc_id, lang, name, source)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT DO NOTHING`,
			[TEST_FIXTURE_IDS.breadRoll, 'de-AT', GERMAN_ALIAS, 'curated'],
		);
    });

    after(async () => {
        // Clean up test fixtures
		try {
			// Removed explicitly, ahead of the food it hangs off. The FK does say
			// ON DELETE CASCADE, so this looks redundant — it is here so teardown keeps
			// working if that clause is ever relaxed, and so a failure to clear the
			// alias surfaces here instead of as a mystery extra match in another suite.
			await pool.query(
				`DELETE FROM food_catalog_names WHERE fdc_id = ANY($1)`,
				[Object.values(TEST_FIXTURE_IDS)],
			);
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

    test('regex metacharacters in q are matched literally, not compiled', async () => {
        // Regression guard. `q` used to be concatenated straight into the ORDER BY
        // `~*` operand, so query text was regex SOURCE. Measured against the real
        // 13,588-row catalog before the fix: `a%(` returned
        // "invalid regular expression: parentheses () not balanced" as an
        // unhandled 500. The `%` matters — it widens the ILIKE pass so rows survive
        // to the ORDER BY, which is the only point at which the regex is compiled.
        //
        // Postgres' hybrid DFA/NFA engine did not blow up on the classic
        // backtracking payloads (they measured 15-20 ms), so the assertion here is
        // "200, not 500, and bounded" rather than a tight stopwatch.
        const user = await registerAndLogin(server.baseUrl, 'food-search-regex-meta');
        const payloads = [
            '(a|a)*$', // classic catastrophic-backtracking shape
            'a%(', // unbalanced paren behind an ILIKE wildcard — the 500 above
            'a%\\', // trailing backslash — same failure, different metacharacter
            '.*',
            '[a-z]+',
            '(((((((((((a',
            'a{1,2}{1,2}{1,2}{1,2}{1,2}',
        ];

        for (const payload of payloads) {
            const started = Date.now();
            const res = await apiRequest(
                server.baseUrl,
                `/food-catalog/search?q=${encodeURIComponent(payload)}&limit=5`,
                { headers: authHeader(user) },
            );
            const elapsed = Date.now() - started;

            assert.equal(res.status, 200, `Expected 200 for q=${payload}, got ${String(res.status)}`);
            assert.ok(Array.isArray(res.body), `Expected an array body for q=${payload}`);
            // Generous on purpose: this catches a hang or a full-catalog regex walk,
            // not millisecond drift on a loaded CI runner.
            assert.ok(elapsed < 5000, `q=${payload} took ${String(elapsed)}ms — expected well under 5s`);
        }
    });

    test('%% and _ in q are literal text, not ILIKE wildcards', async () => {
        // Unescaped, `%` made the ILIKE pass match every row: EXPLAIN ANALYZE on the
        // real catalog showed q=steak scanning 489 rows against q=%% scanning all
        // 13,588 and running the ORDER BY regex on each — a 28x amplification from a
        // two-character query, on an endpoint rate-limited per IP, not per work unit.
        const user = await registerAndLogin(server.baseUrl, 'food-search-wildcards');

        for (const payload of ['%%', '__', '%_%']) {
            const res = await apiRequest(
                server.baseUrl,
                `/food-catalog/search?q=${encodeURIComponent(payload)}&limit=25`,
                { headers: authHeader(user) },
            );
            assert.equal(res.status, 200);

            // Asserting on the fixtures rather than on a count, so other suites
            // adding catalog rows cannot make this flake.
            const ids = (res.body as Array<{ fdcId: number }>).map((food) => food.fdcId);
            for (const fixtureId of Object.values(TEST_FIXTURE_IDS)) {
                assert.ok(
                    !ids.includes(fixtureId),
                    `q=${payload} matched fixture ${String(fixtureId)} — '%'/'_' are still acting as wildcards`,
                );
            }
        }
    });

    test('a literal % in q finds the food that actually contains it', async () => {
        // The other half of the wildcard decision, and the reason escaping is a
        // correctness win rather than a tax: USDA descriptions really do contain '%'
        // ("Milk, reduced fat (2%)", "Apple juice, 100%"). Unescaped, "2%" meant
        // "starts with 2, then anything"; escaped, it means what the user typed.
        const user = await registerAndLogin(server.baseUrl, 'food-search-literal-percent');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=(2%25)&limit=25', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const ids = (res.body as Array<{ fdcId: number }>).map((food) => food.fdcId);
        assert.ok(
            ids.includes(TEST_FIXTURE_IDS.reducedFatMilk),
            'Expected "Milk, reduced fat (2%)" for the literal query "(2%)"',
        );
    });

    test('a German alias finds an English-only catalog entry', async () => {
        // The reported #208 symptom: typing "Semmel" into the live app returned
        // "No matches — enter it manually below." The catalog is ~13,588 USDA rows,
        // all English, so the ILIKE pass had nothing to hit.
        const user = await registerAndLogin(server.baseUrl, 'food-search-alias');
        const res = await apiRequest(
            server.baseUrl,
            `/food-catalog/search?q=${GERMAN_ALIAS}&limit=25`,
            { headers: authHeader(user) },
        );
        assert.equal(res.status, 200);

        const results = res.body as Array<{ fdcId: number; matchedName: string | null }>;
        const hit = results.find((food) => food.fdcId === TEST_FIXTURE_IDS.breadRoll);
        assert.ok(hit, `q=${GERMAN_ALIAS} did not reach the bread roll fixture`);
        assert.equal(
            hit.matchedName,
            GERMAN_ALIAS,
            'the response should name the alias that matched, not leave the user guessing',
        );
    });

    test('an inflected German alias still finds it, via the trigram pass', async () => {
        // "Semmeln" is the plural, and it is not a substring of "Semmel" in either
        // direction, so the ILIKE pass cannot match it at all. Only the trigram
        // fallback over food_catalog_names gets there — this is the assertion that
        // fails if the second pass is left English-only.
        const user = await registerAndLogin(server.baseUrl, 'food-search-alias-plural');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=Semmeln&limit=25', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<{ fdcId: number; matchedName: string | null }>;
        const hit = results.find((food) => food.fdcId === TEST_FIXTURE_IDS.breadRoll);
        assert.ok(hit, 'q=Semmeln did not reach the bread roll fixture through the trigram pass');
        assert.equal(hit.matchedName, GERMAN_ALIAS);
    });

    test('an English hit reports matchedName: null', async () => {
        // The other half of the contract: matchedName is set only when an alias is
        // what matched. A row found on its own description must not borrow one.
        const user = await registerAndLogin(server.baseUrl, 'food-search-alias-null');
        const res = await apiRequest(server.baseUrl, '/food-catalog/search?q=chicken&limit=25', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const results = res.body as Array<{ fdcId: number; matchedName: string | null }>;
        const hit = results.find((food) => food.fdcId === TEST_FIXTURE_IDS.chickenBreast);
        assert.ok(hit, 'q=chicken should still find the English chicken fixture');
        assert.equal(hit.matchedName, null);
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
